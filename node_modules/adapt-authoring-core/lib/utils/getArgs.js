import minimist from 'minimist'

/**
 * Returns the passed arguments, parsed by minimist for easy access
 * @return {Object} The parsed arguments
 * @see {@link https://github.com/substack/minimist#readme}
 */
export function getArgs () {
  const args = minimist(process.argv)
  args.params = args._.slice(2)
  return args
}
