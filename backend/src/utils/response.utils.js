const sendSuccess = (res, data, message, statusCode) => {
  data       = data       || {}
  message    = message    || 'Success'
  statusCode = statusCode || 200
  return res.status(statusCode).json({
    success: true,
    message: message,
    data:    data
  })
}

const sendError = (res, message, statusCode) => {
  message = message || 'An error occurred'
  var code = (typeof statusCode === 'number' && statusCode >= 100 && statusCode <= 599)
    ? statusCode
    : 500
  return res.status(code).json({
    success: false,
    message: String(message)
  })
}

const sendPaginated = (res, data, total, page, limit, message) => {
  message = message || 'Success'
  return res.status(200).json({
    success: true,
    message: message,
    data:    data,
    pagination: {
      total:  total,
      page:   parseInt(page),
      limit:  parseInt(limit),
      pages:  Math.ceil(total / parseInt(limit))
    }
  })
}

module.exports = {
  sendSuccess:    sendSuccess,
  sendError:      sendError,
  sendPaginated:  sendPaginated
}