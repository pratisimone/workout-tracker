export const DEFAULT_PLAN = {
  A: {
    focus: ["Petto", "Dorso", "Spalle", "Tricipiti", "Core"],
    exercises: [
      { name: "Panca piana manubri", sets: 3, repRange: [6, 9], targetRir: 2, restSeconds: 150, currentLoad: 26, loadUnit: "kg_per_hand", priority: "high" },
      { name: "Lat machine prona", sets: 3, repRange: [7, 10], targetRir: 1.5, restSeconds: 120, currentLoad: 70, loadUnit: "kg", priority: "high" },
      { name: "Chest press", sets: 2, repRange: [8, 12], targetRir: 1, restSeconds: 90, currentLoad: null, loadUnit: "kg" },
      { name: "Pulley basso", sets: 2, repRange: [8, 12], targetRir: 1.5, restSeconds: 90, currentLoad: null, loadUnit: "kg" },
      { name: "Alzate laterali al cavo", sets: 3, repRange: [12, 20], targetRir: 0.5, restSeconds: 60, currentLoad: null, loadUnit: "kg", priority: "high" },
      { name: "Tricipiti overhead al cavo", sets: 2, repRange: [10, 15], targetRir: 0.5, restSeconds: 60, currentLoad: null, loadUnit: "kg", priority: "high" },
      { name: "Ab wheel", sets: 2, repRange: [6, 12], targetRir: 2, restSeconds: 60, currentLoad: null, loadUnit: "bodyweight", priority: "high" }
    ]
  },
  B: {
    focus: ["Gambe", "Core", "Catena posteriore", "Lombare"],
    exercises: [
      { name: "Squat Smith", sets: 3, repRange: [6, 8], targetRir: 2, restSeconds: 165, currentLoad: 70, loadUnit: "kg", failureAllowed: false, priority: "high", specialNote: "Progressione conservativa per precedente dolore alle ginocchia" },
      { name: "Leg extension", sets: 3, repRange: [10, 15], targetRir: 1, restSeconds: 90, currentLoad: null, loadUnit: "kg" },
      { name: "Leg curl seduto", sets: 3, repRange: [8, 12], targetRir: 1, restSeconds: 90, currentLoad: null, loadUnit: "kg" },
      { name: "Bulgarian split squat", sets: 2, repRange: [8, 12], targetRir: 1.5, restSeconds: 90, currentLoad: null, loadUnit: "kg", specialNote: "Monitorare eventuale dolore al ginocchio" },
      { name: "Calf machine", sets: 3, repRange: [8, 15], targetRir: 1, restSeconds: 90, currentLoad: null, loadUnit: "kg" },
      { name: "Cable crunch", sets: 3, repRange: [8, 15], targetRir: 1, restSeconds: 60, currentLoad: null, loadUnit: "kg", priority: "high" },
      { name: "Back extension", sets: 2, repRange: [10, 15], targetRir: 2.5, restSeconds: 75, currentLoad: null, loadUnit: "kg", priority: "high", specialNote: "Obiettivo: rafforzamento catena posteriore/lombare. Non forzare se compare dolore." }
    ]
  },
  C: {
    focus: ["Spalle", "Dorso", "Petto", "Tricipiti", "Bicipiti", "Core"],
    exercises: [
      { name: "Shoulder press machine", sets: 3, repRange: [6, 10], targetRir: 1.5, restSeconds: 120, currentLoad: null, loadUnit: "kg", priority: "high" },
      { name: "Pulldown machine", sets: 3, repRange: [8, 12], targetRir: 1, restSeconds: 105, currentLoad: null, loadUnit: "kg" },
      { name: "Panca inclinata bilanciere", sets: 3, repRange: [8, 10], targetRir: 1.5, restSeconds: 120, currentLoad: 50, loadUnit: "kg" },
      { name: "Row machine / pulley", sets: 2, repRange: [8, 12], targetRir: 1, restSeconds: 90, currentLoad: null, loadUnit: "kg" },
      { name: "Alzate laterali", sets: 3, repRange: [12, 20], targetRir: 0.5, restSeconds: 60, currentLoad: 10, loadUnit: "kg_per_hand", priority: "high" },
      { name: "Reverse fly ai cavi", sets: 2, repRange: [12, 20], targetRir: 1, restSeconds: 60, currentLoad: null, loadUnit: "kg", priority: "high" },
      { name: "Pushdown tricipiti", sets: 2, repRange: [8, 12], targetRir: 0.5, restSeconds: 60, currentLoad: null, loadUnit: "kg", supersetGroup: "arms", priority: "high" },
      { name: "Curl Scott", sets: 2, repRange: [8, 12], targetRir: 0.5, restSeconds: 60, currentLoad: 28, loadUnit: "kg", supersetGroup: "arms" },
      { name: "Pallof press", sets: 2, repRange: [10, 15], targetRir: 2, restSeconds: 60, currentLoad: null, loadUnit: "kg", priority: "high" }
    ]
  }
};

export const LOAD_UNIT_LABELS = {
  kg: "kg",
  kg_per_hand: "kg/mano",
  bodyweight: "corpo libero"
};

export const DAY_SEQUENCE = ["A", "B", "C"];
