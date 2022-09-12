import fs from "fs/promises";
import { formatClasses, parseBuildings, parseIngredients } from "./utils.js";
import data from "./data/satisfactory.js";

const getData = async src => {
  const data = await fs.readFile(src, { encoding: "utf-8" });
  const parsedData = JSON.parse(data);
  return parsedData;
};

const getResources = data => {
  const resourceDescriptors = data.find(item => item.id === "ResourceDescriptor");
  return resourceDescriptors.items.map(item => ({
    id: item.ClassName,
    name: item.mDisplayName,
    isFluid: item.mStackSize === "SS_FLUID",
    points: item.mResourceSinkPoints * 1,
    rawResource: true,
    energy: item.mEnergyValue * 1,
  }));
};

const getItems = data => {
  const itemData = data.filter(item =>
    [
      "ItemDescriptor",
      "ConsumableDescriptor",
      "ItemDescriptorBiomass",
      "AmmoTypeProjectile",
      "AmmoTypeSpreadshot",
      "AmmoTypeInstantHit",
      "ItemDescriptorNuclearFuel",
      "EquipmentDescriptor",
    ].includes(item.id)
  );
  const items = itemData.reduce((arr, items) => {
    const addItems = items.items.map(item => ({
      id: item.ClassName,
      name: item.mDisplayName,
      isFluid: item.mStackSize === "SS_FLUID",
      points: item.mResourceSinkPoints * 1,
      rawResource: false,
      energy: item.mEnergyValue * 1,
    }));
    return [...arr, ...addItems];
  }, []);

  const rawItems = getResources(data);
  return items.concat(rawItems);
};

const getManufacturers = data => {
  const buildableManufacturers = data.filter(item =>
    ["BuildableManufacturer", "BuildableManufacturerVariablePower"].includes(item.id)
  );
  return buildableManufacturers.reduce((arr, extractors) => {
    const addExtractors = extractors.items.map(item => ({
      id: item.ClassName,
      name: item.mDisplayName,
      power: item.mPowerConsumption * 1,
      powerExponent: item.mPowerConsumptionExponent * 1,
      description: item.mDescription,
      category: "PRODUCTION",
    }));
    return [...arr, ...addExtractors];
  }, []);
};

const getGenerators = data => {
  const buildableGenerators = data.filter(item =>
    ["BuildableGeneratorFuel", "BuildableGeneratorNuclear"].includes(item.id)
  );
  return buildableGenerators.reduce((arr, generators) => {
    const addGenerators = generators.items.map(item => ({
      id: item.ClassName,
      name: item.mDisplayName,
      power: item.mPowerProduction * -1,
      powerExponent: item.mPowerConsumptionExponent * 1,
      description: item.mDescription,
      category: "GENERATOR",
    }));
    return [...arr, ...addGenerators];
  }, []);
};

const getExtractors = data => {
  const buildableExtractors = data.filter(item =>
    [
      "BuildableResourceExtractor",
      "BuildableWaterPump",
      "BuildableFrackingExtractor",
      "BuildableFrackingActivator",
    ].includes(item.id)
  );
  return buildableExtractors.reduce((arr, extractors) => {
    const addExtractors = extractors.items.map(item => ({
      id: item.ClassName,
      name: item.mDisplayName,
      power: item.mPowerConsumption * 1,
      powerExponent: item.mPowerConsumptionExponent * 1,
      description: item.mDescription,
      category: "EXTRACTOR",
    }));
    return [...arr, ...addExtractors];
  }, []);
};

const getBuildings = data => {
  const manufacturers = getManufacturers(data);
  const generators = getGenerators(data);
  const extractors = getExtractors(data);

  return manufacturers.concat(generators).concat(extractors);
};

const getGeneratorRecipes = (data, items) => {
  const fuelTypes = data.filter(item =>
    ["BuildableGeneratorFuel", "BuildableGeneratorNuclear"].includes(item.id)
  );
  // Flatten buildings from fuelTypes array
  const buildings = fuelTypes.reduce((arr, fuelType) => {
    return [...arr, ...fuelType.items];
  }, []);

  // Componse recipes from buildings
  const recipes = buildings.reduce((arr, building) => {
    // Each fuel item will be its own recipe
    const recipes = building.mFuel
      .map(fuel => {
        // Instantiate ingredients and product
        const ingredients = [];
        const product = [];

        // Get a reference to the item in mFuelClass to access energy, isFluid
        const item = items.find(item => item.id === fuel.mFuelClass);
        // Kill this recipe if not an item we're dealing with (biomass)
        if (!item) return null;

        // amount = power * 60 / energy (then convert mL to L)
        const amount =
          (building.mPowerProduction * 60) / item.energy / (item.isFluid ? 1000 : 1);
        ingredients.push({ item: item.id, amount });

        // If a supplemental resource exists (eg Water)
        if (fuel.mSupplementalResourceClass) {
          // amount = power * supplementalRatio * 3/50
          const amount =
            (building.mPowerProduction * building.mSupplementalToPowerRatio * 3) / 50;
          ingredients.push({ item: fuel.mSupplementalResourceClass, amount });
        }

        // If a byproduct exists
        if (fuel.mByproduct) {
          // amount is provided as a ratio of main product
          const byProductAmount = amount * fuel.mByproductAmount;
          const byproduct = {
            item: fuel.mByproduct,
            amount: byProductAmount,
          };
          product.push(byproduct);
        }

        // For now, each recipe can have a display name of Generate Power
        return {
          id: building.ClassName + fuel.mFuelClass,
          name: "Generate Power",
          building: building.ClassName,
          product,
          ingredients,
          alternate: false,
        };
      })
      .filter(recipe => recipe);
    return arr.concat(recipes);
  }, []);

  return recipes;
};

const getRecipes = (data, buildings, items) => {
  const recipeData = data.find(item => item.id === "Recipe");
  const recipes = recipeData.items.map(recipe => {
    const duration = recipe.mManufactoringDuration * 1;
    return {
      id: recipe.ClassName,
      name: recipe.mDisplayName,
      alternate: recipe.ClassName.includes("Alternate"),
      building: parseBuildings(recipe.mProducedIn, buildings),
      ingredients: parseIngredients(recipe.mIngredients, items, duration),
      product: parseIngredients(recipe.mProduct, items, duration),
    };
  });
  // Compose recipes from generator building data and add to main recipes
  const generatorRecipes = getGeneratorRecipes(data, items);
  return recipes.concat(generatorRecipes);
};

const writeJSON = async (arr, fName) => {
  await fs.writeFile("./output/" + fName + ".json", JSON.stringify(arr, null, "\t"));
};

const init = async () => {
  // const data = await getData("./data/satisfactory.json");
  const satisfactory = formatClasses(data);
  const items = getItems(satisfactory);
  const buildings = getBuildings(satisfactory);
  const buildingMap = new Map(buildings.map(building => [building.id, { ...building }]));
  const recipes = getRecipes(satisfactory, buildingMap, items);

  // Filter out recipes that aren't created in production buildings (such as Building Gun recipes)
  const filteredRecipes = recipes.filter(recipe => buildingMap.has(recipe.building));

  // Map out products list from the filtered recipes
  const itemMap = filteredRecipes.reduce((map, recipe) => {
    // If an item doesn't exist as a product or ingredient of our new recipe list then discard it
    recipe.product.forEach(product => {
      if (!map.has(product.item)) {
        const item = items.find(item => item.id === product.item);
        if (!item) return;
        map.set(product.item, item);
      }
    });
    recipe.ingredients.forEach(product => {
      if (!map.has(product.item)) {
        const item = items.find(item => item.id === product.item);
        if (!item) return;
        map.set(product.item, item);
      }
    });
    return map;
  }, new Map());

  // Write to ./output
  await writeJSON(Array.from(buildingMap.values()), "buildings");
  await writeJSON(Array.from(itemMap.values()), "items");
  await writeJSON(filteredRecipes, "recipes");
};

init();
