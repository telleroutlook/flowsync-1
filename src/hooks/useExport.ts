import { useState, useEffect, useCallback } from 'react';
import { Project, Task, DraftAction, TaskStatus, Priority, Draft } from '../../types';
import { apiService } from '../../services/apiService';
import { generateId, getTaskStart, getTaskEnd, formatExportDate, parseDateFlexible } from '../utils';
import { useI18n } from '../i18n';

export type ExportFormat = 'csv' | 'tsv' | 'json' | 'markdown' | 'pdf';
export type ExportScope = 'active' | 'all';
export type ImportStrategy = 'append' | 'merge';

const clampCompletion = (value: number) => Math.min(100, Math.max(0, value));

const formatExportTimestamp = (value?: number) => {
  if (value === undefined || value === null) return '';
  return new Date(value).toISOString();
};

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

const parseBoolean = (value?: string) => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === 'yes' || normalized === '1') return true;
  if (normalized === 'false' || normalized === 'no' || normalized === '0') return false;
  return undefined;
};

const parseNumeric = (value: unknown) => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') return parseDateFlexible(value);
  return undefined;
};

const parseCompletion = (value: unknown) => {
  if (typeof value === 'number' && !Number.isNaN(value)) return clampCompletion(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) return clampCompletion(numeric);
  }
  return undefined;
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
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = parseDelimitedLine(rows[0], delimiter).map(h => h.trim().toLowerCase());
  const records = rows.slice(1).map(line => {
    const cells = parseDelimitedLine(line, delimiter);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? '';
    });
    return record;
  });
  return { headers, records };
};

type ImportTask = Task & { projectName?: string };

interface UseExportProps {
  projects: Project[];
  activeProject: Project;
  activeTasks: Task[];
  refreshData: () => Promise<void>;
  submitDraft: (actions: DraftAction[], options: { createdBy: Draft['createdBy']; autoApply?: boolean; reason?: string; silent?: boolean }) => Promise<any>;
  fetchAllTasks: () => Promise<Task[]>;
}

export const useExport = ({
  projects,
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
    'rowType',
    'projectId',
    'project',
    'projectDescription',
    'projectIcon',
    'projectCreatedAt',
    'projectUpdatedAt',
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
    'updatedAt',
  ];

  const displayHeaders = [
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

  const buildDisplayRows = useCallback((sourceTasks: Task[], exportProjects: Project[]) => {
    const projectLookup = exportProjects.reduce<Record<string, Project>>((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {});
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
  }, [activeProject]);

  const buildExportRows = useCallback((sourceTasks: Task[], exportProjects: Project[]) => {
    const projectLookup = exportProjects.reduce<Record<string, Project>>((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {});
    const projectRows = exportProjects.map(project => ({
      rowType: 'project',
      projectId: project.id,
      project: project.name,
      projectDescription: project.description || '',
      projectIcon: project.icon || '',
      projectCreatedAt: formatExportTimestamp(project.createdAt),
      projectUpdatedAt: formatExportTimestamp(project.updatedAt),
      id: '',
      title: '',
      status: '',
      priority: '',
      assignee: '',
      wbs: '',
      startDate: '',
      dueDate: '',
      completion: '',
      isMilestone: '',
      predecessors: '',
      description: '',
      createdAt: '',
      updatedAt: '',
    }));
    const taskRows = sourceTasks.map(task => {
      const project = projectLookup[task.projectId] || activeProject;
      return {
        rowType: 'task',
        projectId: project.id,
        project: project.name,
        projectDescription: project.description || '',
        projectIcon: project.icon || '',
        projectCreatedAt: formatExportTimestamp(project.createdAt),
        projectUpdatedAt: formatExportTimestamp(project.updatedAt),
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee || '',
        wbs: task.wbs || '',
        startDate: formatExportTimestamp(task.startDate),
        dueDate: formatExportTimestamp(task.dueDate),
        completion: task.completion ?? 0,
        isMilestone: task.isMilestone ? 'true' : 'false',
        predecessors: (task.predecessors || []).join(','),
        description: task.description || '',
        createdAt: formatExportTimestamp(task.createdAt),
        updatedAt: formatExportTimestamp(task.updatedAt),
      };
    });
    return [...projectRows, ...taskRows];
  }, [activeProject]);

  const handleExportTasks = useCallback(async (format: ExportFormat, scope: ExportScope) => {
    const exportDate = new Date();
    const fileStamp = exportDate.toISOString().slice(0, 10);
    const scopeLabel = scope === 'all' ? 'all-projects' : makeSafeFileName(activeProject.name);
    const baseName = `${scopeLabel}-tasks-${fileStamp}`;
    const exportProjects = scope === 'all' ? projects : [activeProject];
    const sourceTasks = scope === 'all' ? await fetchAllTasks() : activeTasks;
    const rows = buildExportRows(sourceTasks, exportProjects);
    const displayRows = buildDisplayRows(sourceTasks, exportProjects);

    if (format === 'json') {
      const payload = {
        version: 2,
        scope,
        exportedAt: exportDate.toISOString(),
        projects: exportProjects,
        tasks: sourceTasks,
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
      const headers = displayHeaders.slice(0, 12);
      const body = displayRows.map(row => ([
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
      const headers = displayHeaders;
      const escapeMd = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
      const body = displayRows.map(row => [
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
      ...rows.map(row => headers
        .map(header => formatCsvValue(String((row as Record<string, unknown>)[header] ?? ''), delimiter))
        .join(delimiter)),
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
  }, [activeProject, activeTasks, projects, fetchAllTasks, buildExportRows, buildDisplayRows, recordExportPreference, t]);

  const handleImportFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const lowerName = file.name.toLowerCase();
      let importedProjects: Project[] = [];
      let importedTasks: ImportTask[] = [];
      const projectById = new Map<string, Project>();
      const projectByName = new Map<string, Project>();

      const registerProject = (project: Project) => {
        const nameKey = project.name.trim().toLowerCase();
        const existingById = projectById.get(project.id);
        const existingByName = nameKey ? projectByName.get(nameKey) : undefined;
        const target = existingById || existingByName;
        if (target) {
          if (project.name && project.name !== target.name) target.name = project.name;
          if (project.description !== undefined) target.description = project.description;
          if (project.icon !== undefined) target.icon = project.icon;
          if (project.createdAt !== undefined) target.createdAt = project.createdAt;
          if (project.updatedAt !== undefined) target.updatedAt = project.updatedAt;
          if (!target.id && project.id) {
            target.id = project.id;
            projectById.set(project.id, target);
          }
          return target;
        }
        importedProjects.push(project);
        projectById.set(project.id, project);
        if (nameKey) projectByName.set(nameKey, project);
        return project;
      };

      const resolveProject = (projectId?: string, projectName?: string, meta?: Partial<Project>) => {
        const name = projectName?.trim();
        if (!projectId && !name) return activeProject;
        if (!projectId && name) {
          const existingWorkspace = projects.find(item => item.name === name);
          if (existingWorkspace) {
            projectById.set(existingWorkspace.id, existingWorkspace);
            projectByName.set(name.toLowerCase(), existingWorkspace);
            return existingWorkspace;
          }
        }
        if (projectId) {
          const existing = projectById.get(projectId);
          if (existing) {
            if (meta?.description !== undefined) existing.description = meta.description;
            if (meta?.icon !== undefined) existing.icon = meta.icon;
            if (meta?.createdAt !== undefined) existing.createdAt = meta.createdAt;
            if (meta?.updatedAt !== undefined) existing.updatedAt = meta.updatedAt;
            if (name) existing.name = name;
            return existing;
          }
        }
        if (name) {
          const existingByName = projectByName.get(name.toLowerCase());
          if (existingByName) {
            if (meta?.description !== undefined) existingByName.description = meta.description;
            if (meta?.icon !== undefined) existingByName.icon = meta.icon;
            if (meta?.createdAt !== undefined) existingByName.createdAt = meta.createdAt;
            if (meta?.updatedAt !== undefined) existingByName.updatedAt = meta.updatedAt;
            return existingByName;
          }
        }
        return registerProject({
          id: projectId || generateId(),
          name: name || activeProject.name,
          description: meta?.description,
          icon: meta?.icon,
          createdAt: meta?.createdAt,
          updatedAt: meta?.updatedAt,
        });
      };

      const parseProjectRecord = (record: Record<string, unknown>) => {
        const name = typeof record.name === 'string' ? record.name : '';
        if (!name) return null;
        return {
          id: typeof record.id === 'string' ? record.id : generateId(),
          name,
          description: typeof record.description === 'string' ? record.description : undefined,
          icon: typeof record.icon === 'string' ? record.icon : undefined,
          createdAt: parseNumeric(record.createdAt),
          updatedAt: parseNumeric(record.updatedAt),
        } satisfies Project;
      };

      const parseTaskRecord = (record: Record<string, unknown>) => {
        const projectName = typeof record.project === 'string' ? record.project : undefined;
        const projectId = typeof record.projectId === 'string' ? record.projectId : undefined;
        const project = resolveProject(projectId, projectName, {
          description: typeof record.projectDescription === 'string' ? record.projectDescription : undefined,
          icon: typeof record.projectIcon === 'string' ? record.projectIcon : undefined,
          createdAt: parseNumeric(record.projectCreatedAt),
          updatedAt: parseNumeric(record.projectUpdatedAt),
        });
        const predecessors = Array.isArray(record.predecessors)
          ? record.predecessors.filter((item): item is string => typeof item === 'string')
          : typeof record.predecessors === 'string'
            ? record.predecessors.split(',').map(item => item.trim()).filter(Boolean)
            : undefined;
        const milestone = typeof record.isMilestone === 'boolean'
          ? record.isMilestone
          : parseBoolean(typeof record.isMilestone === 'string' ? record.isMilestone : undefined);
        return {
          id: typeof record.id === 'string' ? record.id : generateId(),
          projectId: project.id,
          projectName: project.name,
          title: typeof record.title === 'string' ? record.title : 'Untitled Task',
          description: typeof record.description === 'string' ? record.description : undefined,
          status: normalizeStatus(typeof record.status === 'string' ? record.status : undefined),
          priority: normalizePriority(typeof record.priority === 'string' ? record.priority : undefined),
          wbs: typeof record.wbs === 'string' ? record.wbs : undefined,
          createdAt: parseNumeric(record.createdAt) ?? Date.now(),
          updatedAt: parseNumeric(record.updatedAt),
          startDate: parseNumeric(record.startDate),
          dueDate: parseNumeric(record.dueDate),
          completion: parseCompletion(record.completion),
          assignee: typeof record.assignee === 'string' ? record.assignee : undefined,
          isMilestone: milestone,
          predecessors,
        };
      };

      if (lowerName.endsWith('.json')) {
        try {
          const payload = JSON.parse(content) as Record<string, unknown>;
          if (payload.version !== 2) {
            alert(t('import.failed_invalid_version'));
            return;
          }
          if (!Array.isArray(payload.projects) || !Array.isArray(payload.tasks)) {
            alert(t('import.failed_invalid_format'));
            return;
          }
          const payloadProjects = payload.projects as Record<string, unknown>[];
          payloadProjects.forEach((raw) => {
            if (!raw || typeof raw !== 'object') return;
            const project = parseProjectRecord(raw as Record<string, unknown>);
            if (project) registerProject(project);
          });
          const payloadTasks = payload.tasks as Record<string, unknown>[];
          importedTasks = payloadTasks
            .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === 'object')
            .map(raw => parseTaskRecord(raw));
        } catch {
          alert(t('import.failed_invalid_json'));
          return;
        }
      } else if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) {
        const { headers, records } = parseDelimitedContent(content);
        const requiredHeaders = exportHeaders.map(header => header.toLowerCase());
        const headerSet = new Set(headers);
        const hasRequiredHeaders = requiredHeaders.every(header => headerSet.has(header));
        if (!hasRequiredHeaders) {
          const missing = requiredHeaders.filter(header => !headerSet.has(header));
          alert(t('import.failed_missing_headers', { headers: missing.join(', ') }));
          return;
        }
        for (const record of records) {
          const rowType = (record.rowtype || '').toLowerCase();
          if (rowType !== 'project' && rowType !== 'task') {
            alert(t('import.failed_invalid_rowtype'));
            return;
          }
          const projectMeta = {
            description: record.projectdescription || undefined,
            icon: record.projecticon || undefined,
            createdAt: parseNumeric(record.projectcreatedat),
            updatedAt: parseNumeric(record.projectupdatedat),
          };
          if (rowType === 'project') {
            const name = record.project || undefined;
            if (!name && !record.projectid) return;
            resolveProject(record.projectid || undefined, name, projectMeta);
            continue;
          }
          const project = resolveProject(record.projectid || undefined, record.project || undefined, projectMeta);
          importedTasks.push({
            id: record.id || generateId(),
            projectId: project.id,
            projectName: project.name,
            title: record.title || 'Untitled Task',
            description: record.description || undefined,
            status: normalizeStatus(record.status),
            priority: normalizePriority(record.priority),
            wbs: record.wbs || undefined,
            createdAt: parseNumeric(record.createdat) ?? Date.now(),
            updatedAt: parseNumeric(record.updatedat),
            startDate: parseNumeric(record.startdate),
            dueDate: parseNumeric(record.duedate),
            completion: parseCompletion(record.completion),
            assignee: record.assignee || undefined,
            isMilestone: parseBoolean(record.ismilestone),
            predecessors: record.predecessors ? record.predecessors.split(',').map(item => item.trim()).filter(Boolean) : undefined,
          });
        }
      } else {
        alert(t('import.failed_invalid_format'));
        return;
      }

      if (importedTasks.length === 0 && importedProjects.length === 0) {
        alert(t('import.no_tasks'));
        return;
      }

      const runImport = async () => {
        const projectList = await apiService.listProjects();
        const projectById = new Map(projectList.map(project => [project.id, project]));
        const projectByName = new Map(projectList.map(project => [project.name, project]));
        const projectIdMap = new Map<string, string>();
        const projectCreateActions: DraftAction[] = [];
        const projectUpdateActions: DraftAction[] = [];

        importedProjects.forEach(project => {
          const existingById = project.id ? projectById.get(project.id) : undefined;
          const existingByName = projectByName.get(project.name);
          if (existingById) {
            projectIdMap.set(project.id, existingById.id);
            if (importStrategy === 'merge') {
              const existingDescription = existingById.description ?? undefined;
              const existingIcon = existingById.icon ?? undefined;
              const shouldUpdateName = project.name && project.name !== existingById.name;
              const shouldUpdateDescription = project.description !== undefined && project.description !== existingDescription;
              const shouldUpdateIcon = project.icon !== undefined && project.icon !== existingIcon;
              if (shouldUpdateName || shouldUpdateDescription || shouldUpdateIcon) {
                const after: Record<string, unknown> = { name: project.name };
                if (project.description !== undefined) after.description = project.description;
                if (project.icon !== undefined) after.icon = project.icon;
                projectUpdateActions.push({
                  id: generateId(),
                  entityType: 'project',
                  action: 'update',
                  entityId: existingById.id,
                  after,
                });
              }
            }
            return;
          }

          if (existingByName) {
            projectIdMap.set(project.id, existingByName.id);
            return;
          }

          projectIdMap.set(project.id, project.id);
          projectById.set(project.id, project);
          if (!projectByName.has(project.name)) {
            projectByName.set(project.name, project);
          }
          projectCreateActions.push({
            id: generateId(),
            entityType: 'project',
            action: 'create',
            after: {
              id: project.id,
              name: project.name,
              description: project.description,
              icon: project.icon,
              createdAt: project.createdAt,
              updatedAt: project.updatedAt,
            },
          });
        });

        const projectActions = [...projectCreateActions, ...projectUpdateActions];
        if (projectActions.length > 0) {
          await submitDraft(projectActions, { createdBy: 'user', autoApply: true, reason: 'Import projects', silent: true });
        }

        let taskActions: DraftAction[] = [];
        let taskCount = 0;
        if (importedTasks.length > 0) {
          const existingTasks = await fetchAllTasks();
          const existingTaskIds = new Set(existingTasks.map(item => item.id));

          const usedIds = new Set(existingTaskIds);
          const taskIdMap = new Map<string, string>();
          const normalizedTasks = importedTasks.map(task => {
            const originalId = task.id;
            let finalId = originalId;
            if (importStrategy === 'append' && usedIds.has(finalId)) {
              do {
                finalId = generateId();
              } while (usedIds.has(finalId));
            }
            taskIdMap.set(originalId, finalId);
            usedIds.add(finalId);
            return { ...task, id: finalId };
          });

          const remappedTasks = normalizedTasks.map(task => ({
            ...task,
            predecessors: task.predecessors?.map(pred => taskIdMap.get(pred) ?? pred),
          }));

          const resolvedTasks = remappedTasks.map(task => {
            const mappedProjectId = projectIdMap.get(task.projectId);
            let projectId = mappedProjectId || (task.projectId && projectById.has(task.projectId) ? task.projectId : undefined);
            if (!projectId && task.projectName) {
              const byName = projectByName.get(task.projectName);
              if (byName) projectId = byName.id;
            }
            if (!projectId) projectId = activeProject.id;
            return { ...task, projectId };
          });

          taskActions = resolvedTasks.map(task => {
            const shouldUpdate = importStrategy === 'merge' && existingTaskIds.has(task.id);
            const afterPayload: Record<string, unknown> = {
              projectId: task.projectId,
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              wbs: task.wbs,
              startDate: task.startDate,
              dueDate: task.dueDate,
              completion: task.completion,
              assignee: task.assignee,
              isMilestone: task.isMilestone,
              predecessors: task.predecessors,
            };
            if (!shouldUpdate) {
              afterPayload.id = task.id;
              afterPayload.createdAt = task.createdAt;
              afterPayload.updatedAt = task.updatedAt;
            }
            return {
              id: generateId(),
              entityType: 'task',
              action: shouldUpdate ? 'update' : 'create',
              entityId: shouldUpdate ? task.id : undefined,
              after: afterPayload,
            };
          });
          taskCount = resolvedTasks.length;

          if (taskActions.length > 0) {
            await submitDraft(taskActions, { createdBy: 'user', autoApply: true, reason: 'Import tasks', silent: true });
          }
        }

        if (projectActions.length > 0 || taskActions.length > 0) {
          await refreshData();
          const projectCount = projectCreateActions.length + projectUpdateActions.length;
          alert(
            importStrategy === 'merge'
              ? t('import.success_summary_merged', { projectCount, taskCount })
              : t('import.success_summary_imported', { projectCount, taskCount })
          );
        }
      };

      void runImport();
    };
    reader.readAsText(file);
  }, [importStrategy, projects, activeProject, fetchAllTasks, submitDraft, refreshData, t]);

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
