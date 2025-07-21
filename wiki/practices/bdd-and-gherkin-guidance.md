# BDD and Gherkin Guidance

The goal of this project is to use BDD, specifically Concise Declarative Gherkin to drive development. Concise Declarative Gherkin will be supported by other artifacts, denoted as "context". Context can be any other artifacts required to implement a change in this project.

This document is to help understand the context related to Concise Declarative Gherkin.
By providing this context, the acceptance criteria can be smaller and easier to understand. To
implement code based on the BDD and related artifacts.

## Concise Declarative Gherkin

There are two types of Gherkin, imperative and declarative. Imperative is hard to understand and is very detailed. Declarative is
short and easier to understand, when you have the right context. Go here to learn more about [Concise Declarative Gherkin](./concise-declarative-gherkin.md). Concise Declarative Gherkin is used exclusively in this project. Imperative and other versions of declarative Gherkin are not allowed.

Concise Declarative Gherkin does expose the underlying technology. For example, a credit card application can be done in paper, web, mobile, etc. So, the feature files will reference sections of the application, not web page URLs. URLs map is part of the context. In addition, business terms are used, which is also part of the context and is provided. It is critical you highlight when the context and features are out of alignment or there is some type of confusion.

### Test Data

Data Manager is a tool to access test data, which comes in two forms, persona and data chunk. Personas have names and aliases, while data chunks only have names. Data chunks are used to alter a persona to get the desired behavior from a Gherkin scenario. This keeps the number of personas to a manageable number. In addition keeps the dataset small and easy to maintain.

Thus, it is easy to go from feature file to test data using names or alias to access personas. Certain Gherkin steps will highlight modding a persona. In some cases, a data table is provided with an extra column for as not field to provide a reason for the persona to be modified.

Test data will be provided with Gherkin scenarios and/or will use existing test data. Test data is stored in [data.json](../features/data/data.json).

### Low Reuse of Steps

In Concise Declarative Gherkin, steps are typically related to an area of the system, possibly a domain. There are cross-cutting steps, but they are typically limited. Login step are a good example of cross-cutting step. Highly reusable steps are associated with imperative Gherkin, so they are not common in Concise Declarative Gherkin.
