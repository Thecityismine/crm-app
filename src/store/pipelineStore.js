import { create } from 'zustand'

export const usePipelineStore = create((set) => ({
  pipelines: [],
  activePipeline: null,
  stages: [],
  setActivePipeline: (pipeline) => set({ activePipeline: pipeline }),
  setPipelines: (pipelines) => set({ pipelines }),
  setStages: (stages) => set({ stages }),
}))
