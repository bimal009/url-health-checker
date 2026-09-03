export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message)
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, message)
  }
}
