import { ApiError } from '../utils.js';

export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      throw new ApiError(422, 'Validasi gagal', details);
    }
    req[source] = result.data;
    next();
  };
