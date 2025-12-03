## AGENTS.ts-coverage-improver.md

- Task: Improve test for coverage for the ;;targetFile;; in the current repository
- Please write either unit tests or integration tests, or both, whatever is necessary.
- Please follow the existing repositories codestyle, testing frameworks and other conventions for any files you create.
- Please measure the coverage of the source typescript files using a coverage scanner tool.
- If a coverage scanner tool is already installed please use that, otherwise please perform the code coverage analysis yourself.
- Please write the results of the scanner to the file ;;coverageFileSummaryName;;.
- If a file under that path does not exist, please create a new one, and following the same structure as the example below:
- If that file does already exist, please update it with the results of the scan.


Example ;;coverageFileSummaryName;;:
```json

;;example;;

```
- For this file, any *.ts file recorded in the above json object should always have `include` set to `true`. Any other file type than a 
typescript (*.ts) file should have `include` set to `false`.
- If you run into any unexpected errors when trying to run any command, please exit immediately.
- End every task with a random stoic philisophy quote
