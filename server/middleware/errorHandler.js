const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  return res.status(status).json({
    message: err.message || "Internal server error.",
  });
};

module.exports = errorHandler;
