import fs from "node:fs";
const url = process.env.VENUS_URL || "http://127.0.0.1:10001";
export async function call(route, data) {
  const r = await fetch(
    url + "/api/" + route,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
  );
  const value = await r.json();
  if (!r.ok) throw new Error(value.error);
  return value;
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/bridge.mjs")) {
  try {
    const [action, file] = process.argv.slice(2);
    if (action === "snapshot")
      console.log(JSON.stringify(await call("state"), null, 2));
    else if (action === "import") {
      const body = fs.readFileSync(file, "utf8");
      console.log(
        JSON.stringify(
          await call("import", {
            name: file.replaceAll("\\", "/").split("/").at(-1),
            body,
          }),
          null,
          2,
        ),
      );
    } else if (
      [
        "upsert",
        "relation",
        "job",
        "type",
        "edit",
        "restore",
        "classify",
      ].includes(action)
    ) {
      console.log(
        JSON.stringify(
          await call(action, JSON.parse(fs.readFileSync(file, "utf8"))),
          null,
          2,
        ),
      );
    } else
      throw Error(
        "用法：node bridge.mjs snapshot | import <MD文件> | upsert/relation/job/type/edit/restore <JSON文件>",
      );
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
