var StaticSetSource = require('../../lib/main').StaticSetSource;
var concat = require('concat-stream');
var config = require('../../lib/config').config;

module.exports = {
  foo: 'bar',
  logConfig: {
    name: 'sitemapper',
    level: 'debug',
    stream: concat((output) => { })
  },
  sitemaps: {
    "test.com": {
      sitemapIndex: 'testSitemap.xml',
      urlBase: 'http://test.com',
      maxUrlsPerFile: 2
    }
  },
  sources: {
    source1: (sitemapConfig) => {
      return {
        type: StaticSetSource,
        options: {
          siteMap: {
            channel: 'channel1',
            changefreq: 'weekly',
            priority: 1
          },
          options: {
            urls: [
              '/',
              '/about',
              '/faq',
              '/jobs'
            ]
          }
        }
      };
    },
    source2: (sitemapConfig) => {
      return {
        type: StaticSetSource,
        options: {
          siteMap: {
            channel: 'channel2',
            changefreq: 'daily',
            priority: 0.1
          },
          options: {
            urls: [
              '/stuff',
              '/such',
              '/deep/url',
              '/garbage.html'
            ]
          }
        }
      };
    }
  }
};
