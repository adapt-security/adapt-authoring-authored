# Customising the application
The Adapt authoring tool architecture has been designed from the ground up to support full customisation, be it in the form of adding extra self-contained pieces of functionality, or replacing/removing entire chunks of the core feature-set. It is also incredibly simple to add extra functionality that has been written by other developers.

## Module security concerns
Before using any third-party code, please be aware that any modules you choose to install have the potential to cause catastrophic problems for your server. This could include (but is not limited to):
- Unexpectedly modifying database data
- Transmitting personal data to external parties
- Crashing the server
- Erasing of entire hard-disk contents

Most of these issues can be mitigated by making sure your server is correctly configured by an experienced system administrator (i.e. setting correct permissions etc.), but please be **VERY** careful when trusting third-party code.

#### If in doubt, leave it out!
