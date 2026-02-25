// GanttFlow integration via webhook/API
// Syncs project milestones and status into CRM deal records

export const syncGanttFlowProject = async (projectId, dealId, apiKey) => {
  // TODO: Replace with actual GanttFlow API endpoint
  const res = await fetch(`/api/ganttflow/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const project = await res.json()
  return {
    externalProjectId: projectId,
    projectName: project.name,
    currentPhase: project.currentPhase,
    currentMilestone: project.currentMilestone,
    budgetTotal: project.budget?.total,
    budgetSpent: project.budget?.spent,
    percentComplete: project.percentComplete,
    lastSyncedAt: new Date(),
    syncStatus: 'synced',
  }
}
