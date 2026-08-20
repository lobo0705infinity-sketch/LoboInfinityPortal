import assert from 'node:assert/strict'
import fs from 'node:fs'

const api = fs.readFileSync('backend/API.gs', 'utf8')
const auth = fs.readFileSync('backend/AuthApi.gs', 'utf8')
const login = fs.readFileSync('src/components/CommissionerLogin.tsx', 'utf8')
const sidebar = fs.readFileSync('src/components/Sidebar.tsx', 'utf8')

assert.match(api, /case "commissionerPasswordStatus":\s*return getCommissionerPasswordStatus\(\);/)
assert.match(api, /case "setupCommissionerPassword":\s*return setupCommissionerPassword\(e\);/)
assert.match(auth, /const COMMISSIONER_PASSWORD_HASH_PROPERTY = "commissioner:passwordHash";/)
assert.match(auth, /function setupCommissionerPassword\(e\)[\s\S]*LockService\.getScriptLock\(\)[\s\S]*if \(commissionerPasswordConfigured\(\)\)[\s\S]*hashUserPassword\(password\)[\s\S]*COMMISSIONER_PASSWORD_HASH_PROPERTY/)
assert.match(auth, /function createCommissionerSession\(password\)[\s\S]*COMMISSIONER_PASSWORD_HASH_PROPERTY[\s\S]*verifyUserPasswordHash\(password, storedHash\)/)
assert.match(auth, /function createCommissionerSessionRecord\(\)[\s\S]*commissioner: true/)
assert.match(auth, /function validateNativeSession\(token\)[\s\S]*record\.commissioner !== true/)
assert.doesNotMatch(auth.match(/function setupCommissionerPassword\(e\)[\s\S]*?\n}\n/)?.[0] ?? '', /email|Google|Users/)
assert.match(sidebar, /label: 'Commissioner', to: '\/commissioner'/)
assert.match(login, /Set Up Commissioner Access/)
assert.match(login, /Commissioner Login/)
assert.match(login, /Passwords do not match\./)
assert.match(login, /getCommissionerPasswordStatus\(\)[\s\S]*\.then\(\(value\) => \{ if \(active\) setConfigured\(value\) \}\)[\s\S]*\.catch\(\(\) => \{ if \(active\) setConfigured\(true\) \}\)/)
assert.doesNotMatch(login, /Unable to load Commissioner access\./)
assert.doesNotMatch(login, /username|email|Google/i)

console.log('commissioner access checks passed')
