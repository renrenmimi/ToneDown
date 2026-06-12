export class ApiCallError extends Error {
  /** HTTP status, or 0 for network errors / timeouts / bad response shapes. */
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiCallError'
    this.status = status
  }
}

/** Thrown by createEndpoint when the circuit for this route is open. */
export class BreakerOpenError extends Error {
  constructor(breaker: string) {
    super(`BREAKER_OPEN:${breaker}`)
    this.name = 'BreakerOpenError'
  }
}

/** Thrown by createEndpoint when the feature's daily budget is exhausted (enforcing mode only). */
export class BudgetExceededError extends Error {
  constructor(feature: string) {
    super(`BUDGET_EXCEEDED:${feature}`)
    this.name = 'BudgetExceededError'
  }
}
