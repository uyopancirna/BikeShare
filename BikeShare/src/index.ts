import { v4 as uuidv4 } from "uuid";
import { StableBTreeMap } from "azle";
import express from "express";
import { time } from "azle";

/**
 * This type represents a bike rental record in the BikeShare system.
 */
class BikeRental {
  id: string;
  userId: string;
  bikeId: string;
  rentalStart: Date;
  rentalEnd: Date | null;
  rewardPoints: number;
}

const rentalsStorage = StableBTreeMap<string, BikeRental>(0);
const usersStorage = StableBTreeMap<string, { userId: string; points: number }>(1);

const app = express();
app.use(express.json());

// Endpoint to rent a bike and start a rental session
app.post("/rentals", (req, res) => {
  const { userId, bikeId } = req.body;
  const rental: BikeRental = {
    id: uuidv4(),
    userId,
    bikeId,
    rentalStart: getCurrentDate(),
    rentalEnd: null,
    rewardPoints: 0,
  };
  
  rentalsStorage.insert(rental.id, rental);
  
  // Add initial reward points to the user
  let user = usersStorage.get(userId);
  if (!user) {
    user = { userId, points: 0 };
  }
  user.points += 10; // Reward for starting a rental
  usersStorage.insert(userId, user);
  
  res.json(rental);
});

// Endpoint to end a rental session and calculate reward points
app.put("/rentals/:id", (req, res) => {
  const rentalId = req.params.id;
  const rentalOpt = rentalsStorage.get(rentalId);
  
  if (!rentalOpt) {
    res.status(404).send(`Rental with ID ${rentalId} not found`);
  } else {
    const rental = rentalOpt;
    rental.rentalEnd = getCurrentDate();
    rental.rewardPoints = calculateReward(rental);
    
    rentalsStorage.insert(rental.id, rental);
    
    // Update user's reward points
    const user = usersStorage.get(rental.userId);
    if (user) {
      user.points += rental.rewardPoints;
      usersStorage.insert(rental.userId, user);
    }
    
    res.json(rental);
  }
});

// Endpoint to retrieve all rentals
app.get("/rentals", (req, res) => {
  res.json(rentalsStorage.values());
});

// Endpoint to retrieve a specific rental by ID
app.get("/rentals/:id", (req, res) => {
  const rentalId = req.params.id;
  const rentalOpt = rentalsStorage.get(rentalId);
  
  if (!rentalOpt) {
    res.status(404).send(`Rental with ID ${rentalId} not found`);
  } else {
    res.json(rentalOpt);
  }
});

// Endpoint to get the user's reward points
app.get("/users/:userId/rewards", (req, res) => {
  const userId = req.params.userId;
  const userOpt = usersStorage.get(userId);
  
  if (!userOpt) {
    res.status(404).send(`User with ID ${userId} not found`);
  } else {
    res.json({ points: userOpt.points });
  }
});

// Start the Express server
app.listen(8000, () => {
  console.log("BikeShare server running on http://localhost:8000");
});

function getCurrentDate() {
  const timestamp = new Number(time());
  return new Date(timestamp.valueOf() / 1000_000);
}

function calculateReward(rental: BikeRental): number {
  const rentalDuration = rental.rentalEnd ? (rental.rentalEnd.getTime() - rental.rentalStart.getTime()) / 1000 / 60 : 0; // in minutes
  const reward = Math.floor(rentalDuration / 10); // Reward 1 point for every 10 minutes of rental
  return reward;
}
