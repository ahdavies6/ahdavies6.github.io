
# trying to do jekyll-scholar: shitty situation as of 2024 Aug 27

really tried to get things set up with jekyll-scholar (https://github.com/inukshuk/jekyll-scholar?tab=readme-ov-file), but there was no way to configure ruby to get it to work
- with recent ruby (> 3.0), jekyll-scholar doesn't work
- with older ruby (2.7.2, as suggested in tutorial; https://open-research.gemmadanks.com/tutorials/how-to-use-jekyll-scholar-with-github-pages/#downgrade-ruby-locally), apple silicon breaks it ("dyld[...]: missing symbol called" for anything involving gem, bundle, or whatever else in ruby)

current situation: have a "local" ruby version 2.7.2 assigned to this folder (https://github.com/rbenv/rbenv?tab=readme-ov-file#installing-ruby-versions), using nvm 16 (https://gist.github.com/adrienjoly/e29a6e73fb7e701eefd80ff9bde9abeb)
- theoretically this should fix it but it doesn't, and now it takes ETERNITY to load (I think because it's trying to simulate x64 on an arm64 machine -- i.e., apple silicon issue)
- but it should be possible to just switch the ruby back to the global version (see https://github.com/rbenv/rbenv?tab=readme-ov-file#installing-ruby-versions) -- and even if the global has changed, it will be possible to change it back with some `rbenv` command and still be able to run everything as I used to

also tried a whole bunch of other things that didn't work, like...
- doing everything through docker (which should theoretically solve the issue but doesn't let me simultaneously do arm64-v8, which is what M1 is, while also doing ruby 2.7.2)
- direct debugging of issue here (https://github.com/postmodern/ruby-install/issues/409) or here (https://daqo.medium.com/using-chruby-as-the-default-ruby-version-manager-c11346e3cc)
- enjoy the purple links on google if you try this again lol

in sum: if we want to do this, let's switch to a different jekyll theme with everything integrated (which probably actually wouldn't fix it as the issue is with jekyll-scholar, not minimal mistakes) -- or maybe best of all would be to find some equivalent of jekyll for quarto?
