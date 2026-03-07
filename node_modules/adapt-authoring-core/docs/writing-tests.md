# Writing tests

Instructions for writing tests in this project. Both unit tests (per-module) and integration tests (full application) use the same stack and assertion style.

## Stack

- **Test runner:** [`node:test`](https://nodejs.org/api/test.html) (built into Node.js)
- **Assertions:** [`node:assert/strict`](https://nodejs.org/api/assert.html#strict-assertion-mode)

No external test dependencies are needed. Do not introduce Mocha, Jest, or other test frameworks.

> **Note:** Some older modules in the project use Mocha + Should.js. New tests use the built-in Node.js test library instead.

## Assertions

Use `node:assert/strict`. Common patterns:

```js
// equality (uses Object.is)
assert.equal(actual, expected)

// deep equality (objects/arrays)
assert.deepEqual(actual, { key: 'value' })

// booleans
assert.equal(result, true)
assert.equal(result, false)

// truthy / falsy
assert.ok(value)
assert.ok(!value)

// type checks
assert.equal(typeof value, 'object')
assert.ok(Array.isArray(value))
assert.ok(value instanceof MyClass)

// expected errors (sync)
assert.throws(() => dangerousCall(), { name: 'TypeError' })

// expected errors (async)
await assert.rejects(asyncCall(), { name: 'Error' })

// not equal
assert.notEqual(a, b)
assert.notDeepEqual(obj1, obj2)
```

## Async tests

`node:test` supports `async/await` directly:

```js
it('should connect successfully', async () => {
  const result = await instance.connect()
  assert.equal(typeof result, 'object')
})
```

## Dynamic test generation

When testing a function against multiple inputs, generate tests in a loop:

```js
const validInputs = ['a@b.com', 'test@example.org']
const invalidInputs = ['not-an-email', '@missing.user']

validInputs.forEach((input) => {
  it(`should accept ${input}`, () => {
    assert.equal(validate(input), true)
  })
})

invalidInputs.forEach((input) => {
  it(`should reject ${input}`, () => {
    assert.equal(validate(input), false)
  })
})
```

## General rules

- Import `describe`, `it`, `before`, `after` etc. from `node:test`
- Import `assert` from `node:assert/strict` (strict mode uses `deepStrictEqual` by default)
- Use ES module `import` syntax — this project is `"type": "module"`
- Store shared state in `let` variables scoped to the `describe` block
- Don't add external test dependencies — `node:test` and `node:assert` are sufficient
- Don't mock more than necessary — prefer testing real behaviour

---

## Unit tests

Unit tests live inside individual modules and test classes and utilities in isolation.

### File placement and naming

- Tests live in a `tests/` directory at the module root
- One test file per source module, named `<moduleName>.spec.js`
- Test data/fixtures go in `tests/data/`

```
my-module/
├── lib/
│   ├── myModule.js
│   └── myUtils.js
└── tests/
    ├── data/
    │   └── fixtures.json
    ├── myModule.spec.js
    └── myUtils.spec.js
```

### File structure

```js
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import MyModule from '../lib/myModule.js'

describe('My Module', () => {
  let instance

  before(() => {
    instance = new MyModule()
  })

  describe('#methodName()', () => {
    it('should describe expected behaviour', () => {
      assert.equal(instance.methodName(), 'expected')
    })
  })
})
```

- Group tests by method using nested `describe` blocks, prefixed with `#` for instance methods

### Test data

Place fixture files in `tests/data/`. Use `import` or `fs` to load them:

```js
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtures = JSON.parse(readFileSync(join(__dirname, 'data', 'fixtures.json')))
```

### What to test

- All public methods on exported classes and utilities
- Both success and error paths
- Edge cases (empty input, missing arguments, invalid types)
- That errors are thrown or returned where expected (use `assert.throws` / `assert.rejects`)

### What NOT to do

- Don't test private/internal methods (prefixed with `_`)
- Don't write tests that depend on execution order between `describe` blocks

### Add script to package.json

```json
"scripts": {
  "test": "node --test 'tests/*.spec.js'"
}
```

### Add GitHub workflow

The following workflow should be added to `/.github`:

```yaml
name: Tests
on: push
jobs:
  default:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@master
      - uses: actions/setup-node@master
        with:
          node-version: 'lts/*'
          cache: 'npm'
      - run: npm ci
      - run: npm test
```

### Running unit tests

```bash
# run the test suite
npm test

# run the linter
npx standard
```

Both must pass before submitting a pull request.

---

## Integration tests

Integration tests live in the `integration-tests/` package and test the full application with a real database. They boot the app once and exercise cross-module workflows such as authentication, content CRUD, course import, and course build/export.

See the [integration-tests README](../../integration-tests/README.md) for setup and run instructions.

### File placement and naming

All integration test files live in `integration-tests/tests/`, named `<area>.spec.js`:

```
integration-tests/
├── bin/
│   └── run.js              # test runner entry point
├── lib/
│   ├── app.js              # app bootstrap helpers
│   ├── db.js               # database utilities
│   └── fixtures.js         # fixture management
├── tests/
│   ├── auth.spec.js
│   ├── content.spec.js
│   ├── mongodb.spec.js
│   ├── adaptframework-import.spec.js
│   └── ...
└── fixtures/
    ├── manifest.json        # maps fixture keys to files
    └── course-export.zip
```

### App bootstrap helpers

Integration tests share a single app instance. Use the helpers from `lib/app.js`:

```js
import { getApp, getModule, cleanDb } from '../lib/app.js'

// getApp()    — boots the app (cached, only boots once per run)
// getModule() — waits for a named module to be ready (e.g. 'content', 'auth-local')
// cleanDb()   — deletes documents from test collections
```

### File structure

Every integration test follows this pattern:

```js
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { getApp, getModule, cleanDb } from '../lib/app.js'

let content

describe('Content CRUD operations', () => {
  before(async () => {
    await getApp()
    content = await getModule('content')
  })

  after(async () => {
    await cleanDb(['content', 'users', 'authtokens'])
  })

  describe('Course creation', () => {
    it('should insert a course', async () => {
      const course = await content.insert(
        { _type: 'course', title: 'Test Course', createdBy },
        { validate: false, schemaName: 'course' }
      )
      assert.ok(course._id, 'course should have an _id')
      assert.equal(course._type, 'course')
    })
  })
})
```

Key differences from unit tests:

- Always call `await getApp()` in `before()` to ensure the app is booted
- Use `getModule(name)` to get module instances — never import modules directly
- Always clean up in `after()` using `cleanDb(collections)` to avoid cross-test pollution

### Database cleanup

`cleanDb()` accepts an array of collection names to clear. Pass only the collections your tests touch:

```js
after(async () => {
  await cleanDb(['content', 'users', 'authtokens'])
})
```

The default collections (used when called with no arguments) are: `content`, `assets`, `courseassets`, `tags`, `adaptbuilds`, `contentplugins`.

> **Important:** Always include `contentplugins` when cleaning content-related data. Stale plugin records cause `MISSING_SCHEMA` errors on subsequent runs.

### Available modules

Modules are accessed by name via `getModule()`. Common modules used in tests:

| Name | Description |
|------|-------------|
| `content` | Content CRUD (`insert`, `find`, `update`, `delete`) |
| `auth` | Core authentication (token management, `disavowUser`) |
| `auth-local` | Local auth (`register`, `registerSuper`, `setUserEnabled`) |
| `users` | User management (`find`, `update`, `delete`) |
| `roles` | Role management (`find`, `getScopesForRole`) |
| `mongodb` | Raw database access (`find`, `insert`, `getCollection`) |
| `adaptframework` | Course import/build/export (`importCourse`, `buildCourse`) |

### Fixtures

Integration tests use a fixture system for test data such as course export zips.

Fixtures are declared in `fixtures/manifest.json`:

```json
{
  "course-export": "course-export.zip"
}
```

Load a fixture in your test with `getFixture()`, which copies the file to a temp directory to preserve the original:

```js
import { getFixture } from '../lib/fixtures.js'

it('should import a course', async () => {
  const framework = await getModule('adaptframework')
  const importer = await framework.importCourse({
    importPath: await getFixture('course-export'),
    userId: '000000000000000000000000',
    tags: [],
    importContent: true,
    importPlugins: true,
    migrateContent: true,
    updatePlugins: false,
    removeSource: false
  })
  assert.ok(importer.summary.courseId)
})
```

Custom fixtures can be provided via the `CUSTOM_DIR` environment variable. Custom fixtures override built-in fixtures when keys collide.

### Writing assertions

Be specific with assertions. Check exact counts, validate required fields, and verify relationships — don't just check that something is truthy or non-empty:

```js
// Bad — only checks existence
const items = await content.find({ _courseId, _type: 'block' })
assert.ok(items.length > 0, 'should have blocks')

// Good — checks exact count and validates structure
const items = await content.find({ _courseId, _type: 'block' })
assert.equal(items.length, 23, 'should have 23 blocks')
for (const item of items) {
  assert.ok(item.title, `block "${item._id}" should have a title`)
  assert.ok(articleIds.has(item._parentId?.toString()),
    `block "${item._id}" should have an article as parent`)
}
```

When validating content hierarchy, verify that parent references point to items of the correct type:

```js
const blockIds = new Set(
  (await content.find({ _courseId, _type: 'block' })).map(b => b._id.toString())
)
for (const component of components) {
  assert.ok(blockIds.has(component._parentId?.toString()),
    `component "${component._id}" should have a block as parent`)
}
```

### Error assertions

Use a predicate function with `assert.rejects` when errors may have different structures across modules:

```js
await assert.rejects(
  () => authLocal.registerSuper({ email: 'second@example.com', password }),
  (err) => {
    assert.ok(
      err.code === 'SUPER_USER_EXISTS' || err.id === 'SUPER_USER_EXISTS',
      `expected SUPER_USER_EXISTS, got: ${err.code || err.id || err.message}`
    )
    return true
  }
)
```

### Running integration tests

From the adapt-authoring app directory:

```bash
# run all integration tests
npx at-integration-test

# run specific test files
npx at-integration-test auth content

# include custom tests
CUSTOM_DIR=/path/to/custom npx at-integration-test
```
