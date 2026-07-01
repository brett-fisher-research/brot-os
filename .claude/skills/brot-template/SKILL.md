---
name: brot-template
description: Grab a specific template from the templates directory. This can be used for the output format of other skills or when I want to see information presented in a specific way.
argument-hint: "[--new] <template-name> "
---
# Brot Template
Having structure in my AI's outputs is very important to me. Reading long walls of prose is exhausting, so I've created the `./templates` folder which contains Markdown templates for different ways that I want my outputs to look like.

The template-name from $ARGUMENTS should correspond to a template name in the `./templates` directory. If it isn't clear what template the user wants to use, then clarify with the user.

## Template file structure
Each template file should have a frontmatter section at the very minimum with a `description` key explaining how that template file is to be used. Typically I will invoke `/brot-template` with a specific file name, so before using the template just take a look at the description field to understand how to fill it out.

The body of the file should be a code block (three backticks section) that should be filled out.

## Usage

### New templates
When invoked with the `--new` arg, I want to create a new template. Talk through the template with me, then when I confirm, create the new template markdown file in the `./templates` directory.

### Chat messages
I can invoke `/brot-template` from inside of my chat messages like "summarize the goal we've been refining with /brot-template goal".

### Skills
Brot-template can be invoked from other skills. For example, "before finalizing the plan, confirm with the user the final goal they are working towards with /brot-template goal".

## Outputting
It should be obvious from the template file how dynamic values should be populated. If it isn't clarify with the user and suggest updating the template file to make future sessions run better.

Outputting should be pretty much copy-pasting the template file with the filled-in values. Don't take creative liberties. You can be flexible if the situation calls for it.

For example, if a `goal` template only shows one goal, but in the context I am asking to display multiple goals, then make your output fit accordingly.

## Templates
- `goal` — a stated, measurable goal + deterministic verification list.
- `plan` — the recursive `/brot-plan` output: high-level goal + checkbox breakdown with per-leaf tests.
- `humansteps` — the fixed-format manual-steps contract (setup | verify).
