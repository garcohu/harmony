# counter

A score with two functions. `readCount` is voiced for the agent. `resetCount` is not.

From this directory, after the package is built:

```bash
node ../../bin/harmony.js rehearse "read the count and reset it"
node ../../bin/harmony.js call readCount --voice agent
node ../../bin/harmony.js call resetCount --voice agent
```

In a project that depends on Harmony, the score imports the SDK directly:

```js
import { defineScore, defineAction } from "harmony";
```
