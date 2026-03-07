# Bin scripts
The authoring tool core bundle includes a number of useful scripts which make setting up and using the tool more straightforward. This page outlines these scripts and how they function, along with any parameters they may expect.

## Running a bin script

To run a bin script, you must use the npx command which comes bundled with npm which and used to execute node modules. Scripts are run using the following format: **npx** followed by the **script name**, with any **flags or parameters** coming at the end.

As an example, a task called `at-myscript` may be run like so:

> We prefix any core authoring tool scripts `at-` for transparency (as an added bonus they also come towards the top of the `bin/` folder in `node_modules`!).

```bash
npx at-myscript --test=true
```

See the [official npx docs](https://docs.npmjs.com/cli/v7/commands/npx) for more information on npx.

{{{CONTENT}}}

<style>
  h2.script {
    margin-bottom: 5px;   
  }
  h2.script .module {
    font-weight: 300;
    font-size: 16px;
    vertical-align: middle;
  }
  p.description,
  .details ul {
    margin: 0;   
  }
</style>