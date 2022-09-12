export const formatClasses = data => {
  return data.map(item => {
    const className = item.NativeClass.split(".")[1].slice(2, -1);
    return {
      items: item.Classes,
      id: className,
    };
  });
};

export const parseIngredients = (str, items, duration) => {
  const ingredients = parseParentheses(str).flatMap(item => item);
  return ingredients.map(ingredient => {
    const object = ingredient.split(",");
    const item = object[0].split(".")[1].slice(0, -2);
    const itemData = items.find(itemData => itemData.id === item);
    // if (!itemData) throw new Error("item missing " + item);
    const multiplier = 60 / duration;
    const divisor = itemData?.isFluid ? 1000 : 1;
    const amount = parseInt(object[1].split("=")[1]);
    return {
      item,
      amount: (amount / divisor) * multiplier,
    };
  });
};

export const parseBuildings = (str, buildingMap) => {
  if (!str) return null;
  const buildings = parseParentheses(str)[0];
  const parsedBuildings = buildings.split(",").map(building => building.split(".")[1]);
  return parsedBuildings.filter(building => buildingMap.has(building))[0];
};

const parseParentheses = (str, position = 1) => {
  const arr = [];
  let parenDepth = 1;
  let slice = position;
  let i = position;
  outerLoop: for (i; i < str.length; i++) {
    switch (str[i]) {
      case "(":
        parenDepth++;
        if (parenDepth > 1) {
          const [res, idx] = parseParentheses(str, i + 1);
          arr.push(res);
          i = idx;
        }
        break;
      case ")":
        parenDepth--;
        if (parenDepth < 1) {
          const item = str.slice(slice, i);
          arr.push(item);
          slice = i + 3;
        }
        if (parenDepth === 0 && str[i + 1] !== ",") {
          break outerLoop;
        }
        break;
      default:
        break;
    }
  }
  if (position !== 1) return [arr.flatMap(item => item), i + 1];
  return arr;
};
