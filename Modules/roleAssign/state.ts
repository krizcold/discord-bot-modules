import { randomUUID } from 'crypto';
import { PendingRoleAssignment } from './types/roleAssign';
import { loadModuleData, saveModuleData } from '@internal/utils/dataManager';
import { MODULE_NAME } from './constants/prefixes';

const PENDING_FILE = 'pending-assignments.json';

function loadPendingAssignments(guildId: string): PendingRoleAssignment[] {
  return loadModuleData(PENDING_FILE, guildId, MODULE_NAME, []);
}

function savePendingAssignments(guildId: string, assignments: PendingRoleAssignment[]): void {
  saveModuleData(PENDING_FILE, guildId, MODULE_NAME, assignments);
}

export function createPendingAssignment(
  guildId: string,
  userId: string
): PendingRoleAssignment {
  const pending: PendingRoleAssignment = {
    id: randomUUID(),
    guildId,
    creatorId: userId,
    createdAt: Date.now(),
    status: 'draft',
    displayMode: 'embed-inside',
    interactionMode: 'button',
    selectionMode: 'multiple',
    roles: [],
  };

  const assignments = loadPendingAssignments(guildId);
  assignments.push(pending);
  savePendingAssignments(guildId, assignments);

  return pending;
}

export function getPendingAssignment(
  guildId: string,
  pendingId: string
): PendingRoleAssignment | undefined {
  const assignments = loadPendingAssignments(guildId);
  return assignments.find(a => a.id === pendingId);
}

export function updatePendingAssignment(
  guildId: string,
  pendingId: string,
  updates: Partial<PendingRoleAssignment>
): PendingRoleAssignment | undefined {
  const assignments = loadPendingAssignments(guildId);
  const index = assignments.findIndex(a => a.id === pendingId);

  if (index === -1) {
    return undefined;
  }

  assignments[index] = { ...assignments[index], ...updates };

  const pending = assignments[index];
  if (pending.roles && pending.roles.length > 0) {
    assignments[index].status = 'ready';
  } else {
    assignments[index].status = 'draft';
  }

  savePendingAssignments(guildId, assignments);
  return assignments[index];
}

export function deletePendingAssignment(guildId: string, pendingId: string): boolean {
  const assignments = loadPendingAssignments(guildId);
  const index = assignments.findIndex(a => a.id === pendingId);

  if (index === -1) {
    return false;
  }

  assignments.splice(index, 1);
  savePendingAssignments(guildId, assignments);
  return true;
}

export function getPendingAssignmentsByUser(
  guildId: string,
  userId: string
): PendingRoleAssignment[] {
  const assignments = loadPendingAssignments(guildId);
  return assignments.filter(a => a.creatorId === userId);
}

export function cleanupOldPendingAssignments(guildId: string, maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const assignments = loadPendingAssignments(guildId);
  const now = Date.now();
  const filtered = assignments.filter(a => now - a.createdAt < maxAgeMs);
  const removed = assignments.length - filtered.length;

  if (removed > 0) {
    savePendingAssignments(guildId, filtered);
  }

  return removed;
}
