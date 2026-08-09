const bcrypt = require('bcryptjs')

const hashPassword = async function(password) {
  const salt = await bcrypt.genSalt(12)
  return bcrypt.hash(password, salt)
}

const comparePassword = function(plain, hashed) {
  return bcrypt.compare(plain, hashed)
}

const generateTempPassword = function(length) {
  length    = length || 10
  const chars  = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result   = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

module.exports = {
  hashPassword:        hashPassword,
  comparePassword:     comparePassword,
  generateTempPassword: generateTempPassword
}