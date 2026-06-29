import * as express from "express";
import * as fs from "fs";
import * as log from "loglevel";
import * as commandLineArgs from "command-line-args";
import { AddressInfo } from "net";
import * as path from "path";
// import * as reltabSqlite from "reltab-sqlite";
// import { SqliteContext } from "reltab-sqlite";
import { BigQueryDriver } from "reltab-bigquery";
import "reltab-bigquery";
// import { AWSAthenaConnection } from "reltab-aws-athena";
import { getAuthConnectionOptions, SnowflakeDriver } from "reltab-snowflake";
import "reltab-snowflake";
import * as reltab from "reltab";
import { monitorEventLoopDelay } from "perf_hooks";
import { read } from "fs";
import {
  DataSourceConnection,
  DataSourceId,
  DbDataSource,
  EncodedRequestHandler,
  EvalQueryOptions,
  getConnection,
  serverInit,
  TransportServer,
} from "reltab";
import { DuckDBDriver } from "reltab-duckdb";
import * as reltabDuckDB from "reltab-duckdb";

type ServerCliOptions = {
  dataDir: string;
};

const options = commandLineArgs([
  {
    name: "dataDir",
    alias: "d",
    type: String,
    defaultValue: "./public/csv",
  },
]) as ServerCliOptions;

const dataDir = path.resolve(options.dataDir);

const portNumber = parseInt(process.env.PORT || "8765");

/*
const initSqlite = async (): Promise<DataSourceConnection> => {
  const rtOptions: any = { showQueries: true };
  const connKey: DataSourceId = {
    providerName: "sqlite",
    resourceId: ":memory:",
  };
  const dbc = await getConnection(connKey);
  return dbc;
};
*/

const covid19ConnKey: DataSourceId = {
  providerName: "bigquery",
  resourceId: JSON.stringify({
    projectId: "bigquery-public-data",
    datasetName: "covid19_jhu_csse",
  }),
};
const connOpts: EvalQueryOptions = {
  showQueries: true,
};

const initBigquery = async () => {
  const rtc = await reltab.getConnection(covid19ConnKey);
};

const initSnowflake = async () => {
  let connOpts = getAuthConnectionOptions();
  connOpts.database = "SNOWFLAKE";
  connOpts.schema = "ACCOUNT_USAGE";

  const snowflakeConnKey: DataSourceId = {
    providerName: "snowflake",
    resourceId: JSON.stringify(connOpts),
  };

  const rtc = await reltab.getConnection(snowflakeConnKey);
};

/*
const testImportFile = async (
  dbc: DataSourceConnection,
  fileName: string
): Promise<void> => {
  const ctx = dbc as SqliteContext;
  const filePath = path.join(SRV_DIR, fileName);
  log.info("handleImportFile: importing: " + filePath);

  const md = await reltabSqlite.fastImport(ctx.db, filePath);
};
*/

//Old initDuckDB definition - working in memory - all files processed in RAM
// const initDuckDB = async (): Promise<DataSourceConnection> => {
//   const rtOptions: any = { showQueries: true };
//   const connKey: DataSourceId = {
//     providerName: "duckdb",
//     resourceId: ":memory:",
//   };
//   const dbc = await getConnection(connKey);
//   return dbc;
// };

const initDuckDB = async (): Promise<DataSourceConnection> => {
  const rtOptions: any = { showQueries: true };
  
  // Use a specific file path instead of :memory:
  const dbPath = path.join(dataDir, "galaxy_data.duckdb");
  
  const connKey: DataSourceId = {
    providerName: "duckdb",
    resourceId: dbPath, 
  };
  const dbc = await getConnection(connKey);
  return dbc;
};

const duckDBImportFile = async (
  dbc: DataSourceConnection,
  fileName: string
): Promise<void> => {
  const dbds = dbc as DbDataSource;
  const driver = dbds.db as reltabDuckDB.DuckDBDriver;
  const filePath = path.join(dataDir, fileName);
  log.info("handleImportFile: importing: " + filePath);

  await reltabDuckDB.nativeCSVImport(driver.db, filePath);
};

const viewerUrl = "/tadweb-app/index.html";

const rootRedirect = (req: express.Request, res: express.Response) => {
  res.redirect(viewerUrl);
};

type InvokeHandlerMap = { [functionName: string]: EncodedRequestHandler };

class WebTransportServer implements TransportServer {
  private handlers: InvokeHandlerMap = {};

  registerInvokeHandler(
    functionName: string,
    handler: EncodedRequestHandler
  ): void {
    this.handlers[functionName] = handler;
  }

  async handleRequest(
    functionName: string,
    encodedReq: string
  ): Promise<string> {
    const handler: EncodedRequestHandler | undefined =
      this.handlers[functionName];
    if (handler !== null) {
      const retStr = handler(encodedReq);
      return retStr;
    } else {
      throw new Error('No registered handler for "' + functionName + '"');
    }
  }
}

const handleInvoke = async (
  ts: WebTransportServer,
  req: express.Request,
  res: express.Response
) => {
  try {
    // log.info("POST handleInvoke: got request: ", req.body);
    const { functionName, encodedReq } = req.body;
    const resStr = await ts.handleRequest(functionName, encodedReq);
    // log.info("handleInvoke: sending response: ", resStr);
    res.json(resStr);
  } catch (err) {
    log.error("handleInvoke: ", err, (err as any).stack);
  }
};

async function main() {
  log.setLevel(log.levels.INFO);
  log.info("Using data directory: ", dataDir);

  // await initBigquery();
  // await initSnowflake();

  /*
  const dbc = await initSqlite();
  testImportFile(dbc, "movie_metadata.csv");
*/
  const ddbc = await initDuckDB();
  
  // Test files:
  // await duckDBImportFile(ddbc, "movie_metadata.csv");
  //  // Add additional files here:
  // await duckDBImportFile(ddbc, "barttest.csv");
  // await duckDBImportFile(ddbc, "sample.csv");

  /*
  console.log('importing metObjects:');
  const t0 = process.hrtime();
  await duckDBImportFile(ddbc, "MetObjects.csv");
  const t1 = process.hrtime(t0);
  const [t1s, t1ns] = t1;
  log.info("file imported in : %ds %dms", t1s, t1ns / 1e6);
  */

  /*
  const dbc = new BigQueryConnection(
    "bigquery-public-data",
    "covid19_jhu_csse",
    { showQueries: true }
  );

  const ti = await dbc.getTableSchema(
    "bigquery-public-data.covid19_jhu_csse.summary"
  );
  const ti2 = await dbc.getTableSchema(
    "bigquery-public-data.github_repos.commits"
  );
  console.log("tableInfo: ", ti2);

  const ti3 = await dbc.getTableSchema(
    "bigquery-public-data.iowa_liquor_sales.sales"
  );
  console.log("tableInfo: ", ti3);
*/
  /* const dbc = new AWSAthenaConnection({ showQueries: true });

  // const ti = await dbc.getTableSchema("movie_metadata");
  console.log("tableInfo: ", ti);
*/

  log.info("db initialization complete");

  let app = express();
  app.use(express.json({ reviver: reltab.queryReviver }));

  // app.get("/", (req, res) => res.send("Hello World!"));
  app.get("/", rootRedirect);

  app.use(express.static("./public"));

  const ts = new WebTransportServer();
  serverInit(ts);

  app.post("/tadweb/invoke", (req, res) => handleInvoke(ts, req, res));
  const server = app.listen(portNumber, '0.0.0.0', () => {
    const addr = server.address() as AddressInfo;
    log.info("Listening on port ", addr.port);
  });

  // Dynamically handle whatever files Galaxy put in the directory
  try {
    const files = fs.readdirSync(dataDir);
    for (const file of files) {
      if (file.toLowerCase().endsWith(".csv") || file.toLowerCase().endsWith(".tsv")) {
        await duckDBImportFile(ddbc, file);
        log.info(`Imported Galaxy file: ${file}`);
      }
    }
  } catch (err) {
  log.error("Failed to read directory or import files:", err);
  }
}

main();
