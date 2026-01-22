<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/108LxxUEBaRbOP9K_usWgcFdsMTlGD5tz

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Data Export & Import

### Export
- Formats: CSV, TSV, JSON, Markdown, PDF, XLSX
- Scope: Active project or All projects
- XLSX includes an "All Tasks" sheet plus per-project sheets when exporting all projects

### Import
- Formats: JSON, CSV, TSV
- Strategy: Append (add new tasks) or Merge by ID (overwrite tasks with matching IDs)
- Required headers for CSV/TSV (case-insensitive):
  `project,id,title,status,priority,assignee,wbs,startDate,dueDate,completion,isMilestone,predecessors,description,createdAt`
