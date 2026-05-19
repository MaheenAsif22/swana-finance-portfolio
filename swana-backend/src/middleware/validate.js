'use strict';

/**
 * Validates req.body fields.
 * rules: { fieldName: 'required|number|positive|in:a,b,c' }
 * Returns 400 with { error, fields } on failure, else calls next().
 */
function validate(rules) {
  return (req, res, next) => {
    const errors = {};
    for (const [field, rule] of Object.entries(rules)) {
      const val = req.body[field];
      const parts = rule.split('|');

      for (const part of parts) {
        if (part === 'required' && (val === undefined || val === null || val === '')) {
          errors[field] = `${field} is required`;
        } else if (part === 'number' && val !== undefined && isNaN(Number(val))) {
          errors[field] = `${field} must be a number`;
        } else if (part === 'positive' && val !== undefined && Number(val) <= 0) {
          errors[field] = `${field} must be greater than 0`;
        } else if (part.startsWith('in:') && val !== undefined) {
          const allowed = part.slice(3).split(',');
          if (!allowed.includes(val)) {
            errors[field] = `${field} must be one of: ${allowed.join(', ')}`;
          }
        }
      }
    }
    if (Object.keys(errors).length) {
      return res.status(400).json({ error: 'Validation failed', fields: errors });
    }
    next();
  };
}

module.exports = { validate };
