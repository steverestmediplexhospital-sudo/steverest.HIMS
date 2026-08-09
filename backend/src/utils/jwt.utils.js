const jwt = require('jsonwebtoken')

const ACCESS_SECRET  = process.env.JWT_SECRET        || 'access_secret_fallback'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_fallback'
const ACCESS_EXPIRY  = process.env.JWT_EXPIRES_IN     || '15m'
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

const generateAccessToken = function(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY })
}

const generateRefreshToken = function(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY })
}

const verifyAccessToken = function(token) {
  return jwt.verify(token, ACCESS_SECRET)
}

const verifyRefreshToken = function(token) {
  return jwt.verify(token, REFRESH_SECRET)
}

const generateTokenPair = function(payload) {
  return {
    accessToken:  generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  }
}

module.exports = {
  generateAccessToken:  generateAccessToken,
  generateRefreshToken: generateRefreshToken,
  verifyAccessToken:    verifyAccessToken,
  verifyRefreshToken:   verifyRefreshToken,
  generateTokenPair:    generateTokenPair
}