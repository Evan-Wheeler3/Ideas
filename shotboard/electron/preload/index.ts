import { contextBridge } from 'electron'

// The renderer's only door to the desktop. File and export calls are added in later milestones.
const api = {
  platform: process.platform,
  isElectron: true
}

contextBridge.exposeInMainWorld('shotboard', api)

export type ShotBoardApi = typeof api
