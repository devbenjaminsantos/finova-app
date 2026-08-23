export class TransactionImportError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = "TransactionImportError";
    this.code = code;
    this.details = details;
  }
}
