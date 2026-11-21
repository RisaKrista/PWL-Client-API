// Error dengan status HTTP; `errors` berisi pesan per field ({ field: pesan })
export class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export const handleError = (res, err) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...(err.errors && { errors: err.errors }) });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Data yang sama sudah tersimpan.' });
  }
  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
};
