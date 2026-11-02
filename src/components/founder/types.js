// JSDoc shapes of the Founder Lobby API payloads (see src/app/api/founder).

/**
 * @typedef {Object} Countdown
 * @property {string} title
 * @property {string | null} targetAt ISO timestamp
 * @property {string | null} updatedAt
 */

/**
 * @typedef {Object} FounderSettings
 * @property {string | null} companyStartedOn YYYY-MM-DD
 * @property {number} salesTarget INR
 * @property {"INR"} salesCurrency
 * @property {string} updatedAt
 */

/**
 * Shared collection rows carry the PostgreSQL row version used for
 * optimistic concurrency on update and delete.
 * @typedef {Object} VersionedRecord
 * @property {string} id
 * @property {string} version
 * @property {string} updatedAt
 */

/** @typedef {VersionedRecord & { title: string, details: string, milestoneOn: string, status: "planned" | "active" | "achieved" }} Milestone */
/** @typedef {VersionedRecord & { title: string, currentValue: number, targetValue: number, unit: string, deadline: string | null, status: "active" | "paused" | "achieved" }} Target */
/** @typedef {VersionedRecord & { clientName: string, company: string, email: string, owner: string, stage: string, value: number, followUpOn: string | null, notes: string }} Lead */
/** @typedef {VersionedRecord & { title: string, body: string }} Note */

/**
 * @typedef {Object} SalesMetrics
 * @property {number} wonValue
 * @property {number} pipelineValue
 * @property {number} openCount
 * @property {number} conversion Win rate of closed leads, in percent
 * @property {{ stage: string, count: number, value: number }[]} byStage
 * @property {number} largestStage Largest stage count (at least 1, for bar scaling)
 */

export {};
