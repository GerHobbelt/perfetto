# Why a fork?

This repository is a fork of the main Perfetto repository. In this fork, we include the `protoc` binaries directly in the [`/vendored_protoc` directory](./vendored_protoc)
instead of relying on the [`protoc_bin_vendored` crate](https://crates.io/crates/protoc-bin-vendored).

Our decision was driven by an issue with Bazel-based builds: for some reason, Bazel cannot locate the `protoc` binary when it is packaged via the
`protoc_bin_vendored` crate—likely due to its architecture-dependent packaging. By including the appropriate `protoc` binary for each supported,
we simplify the build process and ensure proper detection by Bazel.

**If you intend to track the tip-of-tree (ToT) version, please ensure that you also update and copy over the corresponding `protoc` binaries.**

# Perfetto - System profiling, app tracing and trace analysis

Perfetto is a production-grade open-source stack for performance
instrumentation and trace analysis. It offers services and libraries and for
recording system-level and app-level traces, native + java heap profiling, a
library for analyzing traces using SQL and a web-based UI to visualize and
explore multi-GB traces.

See https://perfetto.dev/docs or the /docs/ directory for documentation.
