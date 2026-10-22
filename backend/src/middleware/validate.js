/**
 * Validates and sanitizes req[source] with a Joi schema. On success the
 * validated value (trimmed, defaults applied, unknown keys stripped) replaces
 * the original; on failure the Joi error goes to the error handler (400).
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req[source] ?? {}, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) return next(error);
    if (source === 'query') {
      // Express 5 exposes req.query as a read-only getter; shadow it on this request
      Object.defineProperty(req, 'query', { value, writable: true, configurable: true, enumerable: true });
    } else {
      req[source] = value;
    }
    return next();
  };
}
