import { useState, useEffect, useCallback } from 'react';
import { Project, Task, DraftAction, TaskStatus, Priority, Draft } from '../../types';
import { apiService } from '../../services/apiService';
import { generateId, getTaskStart, getTaskEnd, formatExportDate, parseDateFlexible } from '../utils';
import { useI18n } from '../i18n';

export type ExportFormat = 'csv' | 'tsv' | 'json' | 'markdown' | 'pdf';
export type ExportScope = 'active' | 'all';
export type ImportStrategy = 'append' | 'merge';

const clampCompletion = (value: number) => Math.min(100, Math.max(0, value));

const makeSafeFileName = (value: string) => {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return cleaned || 'project';
};

const formatCsvValue = (value: string, delimiter: string) => {
  const escaped = value.replace(/"/g, '""');
  if (escaped.includes('"') || escaped.includes('\n') || escaped.includes(delimiter)) {
    return `"${escaped}"`;
  }
  return escaped;
};

const normalizeStatus = (value?: string): TaskStatus => {
  const normalized = (value || '').toUpperCase().replace(/[- ]/g, '_');
  switch (normalized) {
    case 'DONE':
      return TaskStatus.DONE;
    case 'IN_PROGRESS':
      return TaskStatus.IN_PROGRESS;
    default:
      return TaskStatus.TODO;
  }
};

const normalizePriority = (value?: string): Priority => {
  const normalized = (value || '').toUpperCase();
  switch (normalized) {
    case 'HIGH':
      return Priority.HIGH;
    case 'MEDIUM':
      return Priority.MEDIUM;
    default:
      return Priority.LOW;
  }
};

const parseDelimitedLine = (line: string, delimiter: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map(cell => cell.trim());
};

const parseDelimitedContent = (content: string) => {
  const delimiter = content.includes('\t') ? '\t' : ',';
  const rows = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (rows.length === 0) return [];
  const headers = parseDelimitedLine(rows[0], delimiter).map(h => h.trim().toLowerCase());
  return rows.slice(1).map(line => {
    const cells = parseDelimitedLine(line, delimiter);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? '';
    });
    return record;
  });
};

interface UseExportProps {
  projects: Project[];
  tasks: Task[];
  activeProject: Project;
  activeTasks: Task[];
  refreshData: () => Promise<void>;
  submitDraft: (actions: DraftAction[], options: { createdBy: Draft['createdBy']; autoApply?: boolean; reason?: string; silent?: boolean }) => Promise<any>;
  fetchAllTasks: () => Promise<Task[]>;
}

export const useExport = ({
  projects,
  tasks,
  activeProject,
  activeTasks,
  refreshData,
  submitDraft,
  fetchAllTasks
}: UseExportProps) => {
  const { t } = useI18n();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>('active');
  const [lastExportFormat, setLastExportFormat] = useState<ExportFormat>('csv');
  const [importStrategy, setImportStrategy] = useState<ImportStrategy>('append');

  useEffect(() => {
    const storedScope = window.localStorage.getItem('flowsync:exportScope');
    const storedFormat = window.localStorage.getItem('flowsync:exportFormat');
    const storedImportStrategy = window.localStorage.getItem('flowsync:importStrategy');
    if (storedScope === 'active' || storedScope === 'all') {
      setExportScope(storedScope);
    }
    if (storedFormat === 'csv' || storedFormat === 'tsv' || storedFormat === 'json' || storedFormat === 'markdown' || storedFormat === 'pdf') {
      setLastExportFormat(storedFormat);
    }
    if (storedImportStrategy === 'append' || storedImportStrategy === 'merge') {
      setImportStrategy(storedImportStrategy);
    }
  }, []);

  const recordExportPreference = useCallback((format: ExportFormat, scope: ExportScope) => {
    setLastExportFormat(format);
    window.localStorage.setItem('flowsync:exportFormat', format);
    window.localStorage.setItem('flowsync:exportScope', scope);
  }, []);

  const recordImportPreference = useCallback((strategy: ImportStrategy) => {
    setImportStrategy(strategy);
    window.localStorage.setItem('flowsync:importStrategy', strategy);
  }, []);

  const exportHeaders = [
    'project',
    'id',
    'title',
    'status',
    'priority',
    'assignee',
    'wbs',
    'startDate',
    'dueDate',
    'completion',
    'isMilestone',
    'predecessors',
    'description',
    'createdAt',
  ];

  const buildExportRows = useCallback((scope: ExportScope) => {
    const projectLookup = projects.reduce<Record<string, Project>>((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {});
    const sourceTasks = scope === 'all' ? tasks : activeTasks;
    return sourceTasks.map(task => {
      const project = projectLookup[task.projectId] || activeProject;
      return {
        project: project.name,
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee || '',
        wbs: task.wbs || '',
        startDate: formatExportDate(getTaskStart(task)),
        dueDate: formatExportDate(getTaskEnd(task)),
        completion: task.completion ?? 0,
        isMilestone: task.isMilestone ? 'yes' : 'no',
        predecessors: (task.predecessors || []).join(','),
        description: task.description || '',
        createdAt: formatExportDate(task.createdAt),
      };
    });
  }, [projects, tasks, activeTasks, activeProject]);

  const handleExportTasks = useCallback(async (format: ExportFormat, scope: ExportScope) => {
    const exportDate = new Date();
    const fileStamp = exportDate.toISOString().slice(0, 10);
    const scopeLabel = scope === 'all' ? 'all-projects' : makeSafeFileName(activeProject.name);
    const baseName = `${scopeLabel}-tasks-${fileStamp}`;
    const rows = buildExportRows(scope);

    if (format === 'json') {
      const payload = {
        scope,
        exportedAt: exportDate.toISOString(),
        projects: scope === 'all' ? projects : [activeProject],
        tasks: rows,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}.json`;
      link.click();
      URL.revokeObjectURL(url);
      recordExportPreference(format, scope);
      return;
    }

    if (format === 'pdf') {
        // Dynamically import jspdf
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const autoTable = autoTableModule.default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' });
      const headers = exportHeaders.slice(0, 12);
      const body = rows.map(row => ([
        row.project,
        row.id,
        row.title,
        row.status,
        row.priority,
        row.assignee,
        row.wbs,
        row.startDate,
        row.dueDate,
        String(row.completion),
        row.isMilestone,
        row.predecessors,
      ]));
      doc.setFontSize(12);
      doc.text(
        scope === 'all'
          ? t('export.pdf.title_all')
          : t('export.pdf.title_project', { project: activeProject.name }),
        40,
        32
      );
      doc.setFontSize(9);
      doc.text(t('export.exported_at', { date: exportDate.toISOString() }), 40, 48);
      autoTable(doc, {
        head: [headers],
        body,
        startY: 64,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 60 },
          2: { cellWidth: 150 },
          3: { cellWidth: 70 },
          4: { cellWidth: 70 },
          5: { cellWidth: 80 },
          6: { cellWidth: 50 },
          7: { cellWidth: 60 },
          8: { cellWidth: 60 },
          9: { cellWidth: 70 },
          10: { cellWidth: 70 },
          11: { cellWidth: 100 },
        },
        margin: { left: 40, right: 40 },
      });
      doc.save(`${baseName}.pdf`);
      recordExportPreference(format, scope);
      return;
    }

    if (format === 'markdown') {
      const payload = {
        scope,
        exportedAt: exportDate.toISOString(),
      };
      const headers = exportHeaders;
      const escapeMd = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
      const body = rows.map(row => [
        row.project,
        row.id,
        row.title,
        row.status,
        row.priority,
        row.assignee,
        row.wbs,
        row.startDate,
        row.dueDate,
        String(row.completion),
        row.isMilestone,
        row.predecessors,
        row.description,
        row.createdAt,
      ].map(cell => escapeMd(String(cell))).join(' | '));

      const markdown = [
        scope === 'all'
          ? t('export.markdown.title_all')
          : t('export.markdown.title_project', { project: activeProject.name }),
        '',
        t('export.markdown.exported_at', { date: payload.exportedAt }),
        '',
        `| ${headers.join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...body.map(line => `| ${line} |`),
        '',
      ].join('\n');

      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}.md`;
      link.click();
      URL.revokeObjectURL(url);
      recordExportPreference(format, scope);
      return;
    }

    const delimiter = format === 'tsv' ? '\t' : ',';
    const headers = exportHeaders;
    const lines = [
      headers.join(delimiter),
      ...rows.map(row => [
        row.project,
        row.id,
        row.title,
        row.status,
        row.priority,
        row.assignee,
        row.wbs,
        row.startDate,
        row.dueDate,
        String(row.completion),
        row.isMilestone,
        row.predecessors,
        row.description,
        row.createdAt,
      ].map(value => formatCsvValue(String(value), delimiter)).join(delimiter)),
    ];

    const mime = format === 'tsv' ? 'text/tab-separated-values' : 'text/csv';
    const blob = new Blob([lines.join('\n')], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
    recordExportPreference(format, scope);
  }, [activeProject, projects, buildExportRows, recordExportPreference, t]);

  const handleImportFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const lowerName = file.name.toLowerCase();
      let importedProjects: Project[] = [];
      let importedTasks: Task[] = [];

      if (lowerName.endsWith('.json')) {
        try {
          const payload = JSON.parse(content) as {
            projects?: Project[];
            tasks?: Array<Record<string, unknown>>;
          };
          if (Array.isArray(payload.projects)) {
            importedProjects = payload.projects.filter(item => item && typeof item.name === 'string');
          }
          if (Array.isArray(payload.tasks)) {
            importedTasks = payload.tasks.map((raw) => {
              const record = raw as Record<string, unknown>;
              const projectName = typeof record.project === 'string' ? record.project : activeProject.name;
              const project = importedProjects.find(item => item.name === projectName)
                || projects.find(item => item.name === projectName)
                || activeProject;
              return {
                id: typeof record.id === 'string' ? record.id : generateId(),
                projectId: project.id,
                title: typeof record.title === 'string' ? record.title : 'Untitled Task',
                description: typeof record.description === 'string' ? record.description : undefined,
                status: normalizeStatus(typeof record.status === 'string' ? record.status : undefined),
                priority: normalizePriority(typeof record.priority === 'string' ? record.priority : undefined),
                wbs: typeof record.wbs === 'string' ? record.wbs : undefined,
                createdAt: parseDateFlexible(typeof record.createdAt === 'string' ? record.createdAt : undefined) || Date.now(),
                startDate: parseDateFlexible(typeof record.startDate === 'string' ? record.startDate : undefined),
                dueDate: parseDateFlexible(typeof record.dueDate === 'string' ? record.dueDate : undefined),
                completion: typeof record.completion === 'number' ? clampCompletion(record.completion) : undefined,
                assignee: typeof record.assignee === 'string' ? record.assignee : undefined,
                isMilestone: record.isMilestone === 'yes' || record.isMilestone === true,
                predecessors: typeof record.predecessors === 'string'
                  ? record.predecessors.split(',').map(item => item.trim()).filter(Boolean)
                  : undefined,
              };
            });
          }
        } catch {
          alert(t('import.failed_invalid_json'));
          return;
        }
      } else if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) {
        const records = parseDelimitedContent(content);
        importedTasks = records.map(record => {
          const projectName = record.project || activeProject.name;
          const existingProject = projects.find(item => item.name === projectName);
          const project = existingProject || { id: generateId(), name: projectName, description: '', icon: projectName.charAt(0).toUpperCase() };
          if (!existingProject) {
            importedProjects.push(project);
          }
          return {
            id: record.id ? record.id : generateId(),
            projectId: project.id,
            title: record.title || 'Untitled Task',
            description: record.description || undefined,
            status: normalizeStatus(record.status),
            priority: normalizePriority(record.priority),
            wbs: record.wbs || undefined,
            createdAt: parseDateFlexible(record.createdat) || Date.now(),
            startDate: parseDateFlexible(record.startdate),
            dueDate: parseDateFlexible(record.duedate),
            completion: record.completion ? clampCompletion(Number(record.completion)) : undefined,
            assignee: record.assignee || undefined,
            isMilestone: (record.ismilestone || '').toLowerCase() === 'yes',
            predecessors: record.predecessors ? record.predecessors.split(',').map(item => item.trim()).filter(Boolean) : undefined,
          };
        });
      } else {
        alert(t('import.failed_invalid_format'));
        return;
      }

      if (importedTasks.length === 0) {
        alert(t('import.no_tasks'));
        return;
      }

      const existingIds = new Set(tasks.map(task => task.id));
      const normalizedTasks = importedTasks.map(task => ({
        ...task,
        id: importStrategy === 'append' && existingIds.has(task.id) ? generateId() : task.id,
      }));

      const runImport = async () => {
        if (importedProjects.length > 0) {
          const projectActions: DraftAction[] = importedProjects
            .filter(project => !projects.find(item => item.name === project.name))
            .map(project => ({
              id: generateId(),
              entityType: 'project',
              action: 'create',
              after: { name: project.name, description: project.description, icon: project.icon },
            }));
          if (projectActions.length > 0) {
            await submitDraft(projectActions, { createdBy: 'user', autoApply: true, reason: 'Import projects', silent: true });
          }
        }

        const projectList = await apiService.listProjects();
        const existingTasks = await fetchAllTasks();
        const existingTaskIds = new Set(existingTasks.map(item => item.id));
        const projectMap = new Map(projectList.map(project => [project.name, project.id]));
        const taskActions: DraftAction[] = normalizedTasks.map(task => {
          const projectName = projectList.find(project => project.id === task.projectId)?.name || activeProject.name;
          const projectId = projectMap.get(projectName) || task.projectId;
          const shouldUpdate = importStrategy === 'merge' && existingTaskIds.has(task.id);
          const baseAction: DraftAction = {
            id: generateId(),
            entityType: 'task',
            action: shouldUpdate ? 'update' : 'create',
            entityId: shouldUpdate ? task.id : undefined,
            after: {
              projectId,
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              wbs: task.wbs,
              createdAt: task.createdAt,
              startDate: task.startDate,
              dueDate: task.dueDate,
              completion: task.completion,
              assignee: task.assignee,
              isMilestone: task.isMilestone,
              predecessors: task.predecessors,
            },
          };
          return baseAction;
        });

        if (taskActions.length > 0) {
          await submitDraft(taskActions, { createdBy: 'user', autoApply: true, reason: 'Import tasks', silent: true });
          await refreshData();
          alert(
            importStrategy === 'merge'
              ? t('import.success_merged', { count: normalizedTasks.length })
              : t('import.success_imported', { count: normalizedTasks.length })
          );
        }
      };

      void runImport();
    };
    reader.readAsText(file);
  }, [importStrategy, tasks, projects, activeProject, fetchAllTasks, submitDraft, refreshData, t]);

  return {
    isExportOpen,
    setIsExportOpen,
    exportScope,
    setExportScope,
    lastExportFormat,
    importStrategy,
    recordImportPreference,
    handleExportTasks,
    handleImportFile
  };
};
