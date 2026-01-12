import { expect, test, describe } from "bun:test";
import { MoguDetector } from "../index.ts";

describe("MoguDetector", () => {
  test("should detect food in an image", async () => {
    const detector = await MoguDetector.create();
    const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/NCI_Visuals_Food_Hamburger.jpg/1280px-NCI_Visuals_Food_Hamburger.jpg";
    const result = await detector.predictIsFood(imageUrl);
    
    expect(result.isFood).toBe(true);
    expect(result.probability).toBeGreaterThan(0.5);
    
    detector.free();
  }, 30000); // Increased timeout for model download and prediction

  test("should predict top class for food", async () => {
    const detector = await MoguDetector.create();
    const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/NCI_Visuals_Food_Hamburger.jpg/1280px-NCI_Visuals_Food_Hamburger.jpg";
    const result = await detector.predictTopClass(imageUrl);
    
    expect(result.label).toBeDefined();
    expect(result.probability).toBeGreaterThan(0.5);
    
    detector.free();
  }, 30000);
});
