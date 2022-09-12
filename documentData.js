import fs from "fs/promises";
import { formatClasses } from "./utils.js";

// Write file to documentation folder for quick key/value reference
const documentData = async data => {
  const formattedData = formatClasses(data);
  const map = formattedData.map(category => {
    const example = category.items[0];
    return { id: category.id, length: category.items.length, items: example };
  });
  try {
    await fs.writeFile("./documentation/map.json", JSON.stringify(map, null, "\t"));
  } catch (error) {
    console.log(error);
  }
};
export default documentData;
