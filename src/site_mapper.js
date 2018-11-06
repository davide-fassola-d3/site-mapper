import {config} from './config';
import fs from 'fs';
import {each, extend} from 'lodash';
import {Sitemap} from './sitemap';
import async from 'async';

export class SiteMapper {
  constructor(sitemapConfig) {
    this.sitemapConfig = extend({}, config.defaultSitemapConfig, sitemapConfig);
    config.log.info('Site mapper config ', this.sitemapConfig);
    let buildDir = (parentPath, nextPath) => {
      let fullPath;
      if (parentPath.length > 0 && parentPath != "/") {
        fullPath = `${parentPath}/${nextPath}`;
      } else {
        fullPath = `${parentPath}${nextPath}`;
      }
      if (fullPath != "." && fullPath != "") {
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath);
        }
      } else if (fullPath == "") {
        fullPath = "/";
      }
      return fullPath;
    };

    this.sitemapConfig.targetDirectory.split('/').reduce(buildDir, '');
    this.sources = this.initializeSources();
    this.sitemaps = [];
  }
  initializeSources() {
    let sources = [];
    let buildSource = (sourceDefinition, sourceName) => {
      let sourceConfig = sourceDefinition(this.sitemapConfig);
      let sourceClass = sourceConfig.type;
      let sourceOptions = sourceConfig.options;
      config.log.trace(`Building source ${sourceName} with options `, sourceOptions);
      if (!sourceOptions.siteMap.urlFormatter) {
        sourceOptions.siteMap.urlFormatter = config.defaultUrlFormatter(this.sitemapConfig);
      }
      sourceOptions.name = sourceName;
      return new sourceClass(sourceOptions);
    };
    config.log.info("Initializing sources");
    let includes = this.sitemapConfig.sources && this.sitemapConfig.sources.includes;
    let excludes = this.sitemapConfig.sources && this.sitemapConfig.sources.excludes;
    each(config.sources, (sourceDefinition, sourceName) => {
      if (includes && includes.length > 0) {
        // If there is an explicit includes list, only include sources in this list
        if (includes.indexOf(sourceName) >= 0) {
          config.log.info(` -> Explicit include of source ${sourceName}`);
          sources.push(buildSource(sourceDefinition, sourceName));
        }
      } else {
        if (excludes && excludes.indexOf(sourceName) >= 0) {
          config.log.info(` -> Explicit exclude of source ${sourceName}`);
          return;
        }
        config.log.info(` -> Including ${sourceName} since it is not explicitly excluded`);
        sources.push(buildSource(sourceDefinition, sourceName));
      }
    });
    if (sources.length <= 0) {
      throw new Error(`No sitemap source definitions matched includes: ${includes}`);
    }
    config.log.info(`Initialized ${sources.length} sources`);
    return sources;
  }
  generateSitemap(done) {
    async.series([(done) => { return this.generateFiles(done); }, (done) => { return this.generateIndex(done); }], done);
  }
  generateIndex(done) {
    this.indexFiles = {};
    this.indexFiles.default = {
      name: `${this.sitemapConfig.targetDirectory}/${this.sitemapConfig.sitemapIndex}`,
    };
    config.log.info(`Creating sitemap index files, default index = ${this.indexFiles.default.name}`);
    const openIndex = fileName => {
      const indexStream = fs.createWriteStream(fileName);
      indexStream.write(config.sitemapIndexHeader);
      return indexStream;
    }
    const closeIndex = fileStream => {
      fileStream.write("</sitemapindex>");
      fileStream.end();
    }
    this.indexFiles.default.file = openIndex(this.indexFiles.default.name);
    this.indexFiles.default.file.on("finish", done);
    this.indexFiles.default.file.on("error", done);
    this.sitemaps.forEach((sitemap) =>{
      sitemap.allFiles().forEach( (file) => {
         this.indexFiles.default.file.write(file.toIndexXml());
      });
    });
    closeIndex(this.indexFiles.default.file);
  }
  generateFiles(done) {
    let tasks = this.sources.map((source) => {
      return (cb) => {
        let ended = false;
        let endTask = (err) => {
          if (!ended) {
            ended = true;
            cb(err);
          } else {
            config.log.trace("Tried to call back more than once with: ", err);
          }
        }
        config.log.info(`Generating sitemap(s) for source ${source.name}`);
        let sitemap = new Sitemap({source: source, sitemapConfig: this.sitemapConfig}).
          on('error', (err) => {
            if (source.ignoreErrors) {
              config.log.warn(`Ignoring error by configuration`, err)
              endTask();
            } else {
              endTask(err);
            }
          }).on('finish', () => {
            let closedRemaining = false;
            let waiting = () => {
              let [pushed, drained] = sitemap.totalUrls();
              config.log.trace(`Waiting for sitemap(s) for source ${source.name}, processed ${drained}/${pushed} URLS`);
              if (drained < pushed) {
                setTimeout(waiting, 100);
              } else {
                if (!closedRemaining) {
                  closedRemaining = true;
                  sitemap.closeRemaining();
                  setTimeout(waiting, 100);
                } else {
                  config.log.info(`Processed ${drained}/${pushed} URLS to sitemap ${source.name}`);
                  this.sitemaps.push(sitemap);
                  endTask(null);
                }
              }
            };
            setTimeout(waiting, 100);
          });
        sitemap.open();
      };
    });
    async.series(tasks, (err, results) => {
      done(err, this.sitemaps);
    });
  }
}
