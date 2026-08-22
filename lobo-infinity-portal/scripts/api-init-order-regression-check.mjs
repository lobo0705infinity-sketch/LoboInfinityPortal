import { findInitializationOrderFailures } from './api-init-order-check.mjs'

const failures = []

expectPass(
  'context property access',
  `function example(e, context) {
    requireApiPermission(context.auth, "permission");
  }`,
)
expectPass(
  'request property access',
  `function example(e, request) {
    requireApiPermission(request.auth, "permission");
  }`,
)
expectFailure(
  'standalone pre-declaration auth',
  `function example(e) {
    requireApiPermission(auth, "permission");
    const auth = getAuth();
  }`,
  'auth',
)
expectPass(
  'correctly ordered standalone auth',
  `function example(e) {
    const auth = getAuth();
    requireApiPermission(auth, "permission");
  }`,
)
expectPass(
  'identifier boundaries',
  `function example(e) {
    const authResult = getAuthResult();
    const authentication = authResult.authentication;
    const author = authentication.author;
    return author;
  }`,
)

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('API initialization-order regression checks passed.')

function expectPass(name, source) {
  const results = findInitializationOrderFailures(source, `${name}.gs`)
  if (results.length > 0) {
    failures.push(`${name} should pass: ${results.join('; ')}`)
  }
}

function expectFailure(name, source, identifier) {
  const results = findInitializationOrderFailures(source, `${name}.gs`)
  if (!results.some((result) => result.includes(`references ${identifier} before declaration`))) {
    failures.push(`${name} should detect pre-declaration ${identifier}.`)
  }
}
