# CSS Styling in the UI

This document describes the organization of CSS styling rules for the UI, how those styles are used for theming the UI, and how they are accessed from canvas rendering code.

## Modular CSS

The source for the UI's CSS stylesheet is the [src/assets/perfetto.scss](../../ui/src/assets/perfetto.scss) file.
As its name indicates, this uses the SCSS ([Sass][sass]) framework for modular CSS definitions.
The output of the CSS build from this source file and its included modules is [perfetto.css](../../ui/out/dist_version/perfetto.css).

The [assets/](../../ui/src/assets/) directory contains a number of SCSS modules corresponding to major parts of the UI:

- `common.scss` provides core style classes for the main Perfetto UI and imports all of the theming concerns such as fonts, colours, shadows, etc. (more on those [below](#theming))
- `roots.scss` provides an SCSS macro that applies CSS rules to the various [structural roots](#roots) of the Perfetto UI, as elaborated [below](#roots)
- `details.scss` provides styling of the Details panel and related elements
- other files such as `topbar.scss`, `sidebar.scss`, `viewer_page.scss` cover the various top-level components of the main UI in largely self-evident fashion

The widgets comprising the UI component library for reusable elements such as buttons, menus, tables, tabbed panels, and more have their styles defined in SCSS modules in the [src/assets/widgets/](../../ui/src/assets/widgets/) directory.
These modules correspond roughly one-for-one to the widget implementations in the [src/widgets/](../../ui/src/widgets/) directory.

[sass]: https://sass-lang.com

## Class Naming

As much as possible, in the interest of ensuring isolation of the UI's CSS styling from any application that embeds it, styling is applied to UI elements by class.
To mitigate potential clashes with CSS class names in an embedding application, class names should be prefixed with `pf-` whenever there is a possibility that a class will be first member of a selector for any rule.
In the interest of succinctness and clarity, where class names are only used within the scope of more general selectors, especially in nested SCSS rules, then the `pf-` prefix may be omitted.

There is one special class named `perfetto` that is applied to the `<main>` element that renders the main UI.
This is intended to allow embedding applications to target CSS rules to the Perfetto UI if necessary to override styles in some fashion that is not accommodated by the [theme variables](#theming).
It is not intended to be used by the UI's own default styling or themes, except in the very limited case described in the next section.

## Roots

One of the goals of the style definitions in the UI is to work well in applications that embed the Perfetto UI for whatever purpose.
In practice, this means that CSS styles must not "leak" from Perfetto UI's stylesheet into the embedding application and also that styles must not leak from that embedding context into Perfetto UI.
This is largely ensured by rigorous application of CSS classes for styling, with the `pf-` prefix as [discussed above](#class-naming).
However, there are certain default styles that it is practical to apply on a structural basis to elements more generally.
To that end, the [roots.scss](../../ui/src/assets/roots.scss) module provides a `pf-roots` macro.
This macro expands the CSS rule passed to it into selectors for all of the currently known roots of the UI DOM:

- `main.perfetto`: the `<main>` element that renders the main Perfetto UI, which may or may not be embedded within some other application
- `.pf-popup-portal` the `<div>` that contains menus and other pop-ups hoisted to the top of the DOM via a Mithril portal comonent, which again may or may not be embedded within some other application
- `body[data-perfetto_version]` for default styling that must only be effective in the stand-alone Perfetto UI application, not in an embedded context

This `pf-root` macro is used for a few specific long-standing rules in the `common.scss` module and is not intended for any additional application.
New style definitions should prefer a [class-based approach](#class-naming) over any structural selectors that would rely on `pf-root`.

## Theming

Also in the `src/widgets/` directory, though not only intended for widgets, are two files implementing theming for the UI:

- [theme_variables.scss](../../ui/src/assets/widgets/theme_variables.scss) provides a `:root` rule definining CSS variables for all of the fonts, colours, shadows, and other style definitions that are potentially configurable by _themes_.
As such, these need to be standard CSS variables, exposed at run-time in the CSS engine, so that they may be substitutable by selection of different themes in Perfetto UI itself or by an application that embeds the Perfetto UI and so needs to style it to match its own theme
- [theme.scss](../../ui/src/assets/widgets/theme.scss) defines a number of SCSS build-time variables and macros that are used throughout the style definitions of the widgets and other components, in large part leveraging the CSS variables described in the previous `theme_variables.scss` module

All theme variables defined for the UI are prefixed with `pf-` to allow them to coexist with any potential embedding applications theming scheme.
Applications that wish to override the UI's default theme must ensure that their redefinitions of these variables are effective on the `<html><body>` element in the DOM, as explained in the next section.

## Canvas Rendering

The TS/JS code that renders canvas content at run-time must naturally fit into the static styling scheme of the UI.
This means that the various painting routines of components such as track renderers and the timeline overview access at run-time to the DOM's current effective CSS stylesheet.
This is accomplished by looking up the current values of as many of the CSS variables defined in the `theme_variables.scss` module as are required and storing them in pseudo-constants, in the [css_constants.ts](../../ui/src/frontend/css_constants.ts) TS module.
The `initCssConstants()` function is invoked at UI start-up to fill the initial values of these pseudo-constants and on receipt of the `'RELOAD-CSS-CONSTANTS'` message.
Embedding applications must ensure reloading of the CSS pseudo-constants whenever they change the theme.

Crucially, `initCssConstants()` function extracts the values of CSS variables from the effective styling of the `<html><body>` element.
This obviously catches the UI's default theme as defined in the `:root` rule in `theme_variables.scss` but it requires Perfetto UI or any other application embedding it to override this theme, if at all, by redefining those CSS variables at this level of the DOM.
