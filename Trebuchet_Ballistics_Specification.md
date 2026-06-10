# Prototype Specification: Trebuchet Ballistics System ("Math Kingdom")

This document serves as a direct handoff for a coding agent to implement the first physics-based math mechanic for the "Math Kingdom" summer beta project.

## 1. System Overview
The **Trebuchet Ballistics System** is an interactive physics sandbox where 10-year-old players use mathematical calculations to calibrate a siege engine. The objective is to launch projectiles over obstacles to clear map nodes or defeat group "bosses."

## 2. Core Game Loop & Architecture
* **Input Phase:** Player is presented with a target distance/height and a mathematical equation.
* **Calculation Phase:** Player inputs numerical values derived from solving the math problem to set the Trebuchet’s parameters (Counterweight Mass & Release Angle).
* **Simulation Phase:** The game runs a 2D physics simulation showing the trajectory of the projectile.
* **Feedback Phase:** * *Success:* Target hit, destruction animation, rewards/materials distributed.
    * *Failure:* Projectile misses or misfires (destroys own trebuchet if math is significantly incorrect), triggers a short, humorous "repair" delay.

## 3. Mathematical-Physics Mechanics

### Mechanics Formulae (Simplified for 10-Year-Olds)
To keep the physics deterministic but manageable, use a simplified projectile motion model where air resistance is negligible.

1.  **Counterweight Calibration (Multiplication/Ratios):**
    * **Concept:** To generate enough initial velocity ($v_0$), the player must calculate the required counterweight mass ($M_c$) based on a given projectile mass ($m_p$) and a target force ratio ($R$).
    * **Equation:** $M_c = m_p 	imes R$
    * *Example Prompt:* "Your projectile weighs 12kg. To clear the mountain wall, you need a force ratio of 9x. What must your counterweight weigh?" (Answer: 108kg).

2.  **Launch Angle Adjustment (Geometry/Degrees):**
    * **Concept:** Players adjust the release pin angle ($	heta$) using a radial slider or direct degree input.
    * **Logic:** Standard 2D projectile range equation: 
        $$Range = rac{v_0^2 \sin(2	heta)}{g}$$
    * To keep it accessible, provide target zones corresponding to specific angles (e.g., $45^\circ$ for maximum range, $60^\circ$ to loft over high walls).

## 4. Coding Instructions & Technical Requirements

### Physics Engine Requirements
* Use a lightweight 2D physics framework (e.g., **Pygame + Pymunk** for Python, or **Matter.js** for web/HTML5).
* The Trebuchet should have rigid body constraints: a pivot base, a rotating arm, a heavy counterweight box, and a release hook.

### State & Error Handling
* **Marginal Error (Within $\pm5\%$ of correct answer):** Projectile fires but lands short or long. Display trajectory trail to allow the player to self-correct ("Rubber Banding").
* **Critical Error ($>20\%$ deviation or negative inputs):** Trigger a "Spectacular Failure" animation. The arm snaps or the projectile releases straight up, crashing onto the trebuchet itself. Set a 5-second cooldown timer before the player can re-try.

### Extensibility Checklist
* [ ] **Custom Ammo Object Factory:** Allow the projectile sprite and mass to change dynamically (e.g., Watermelon [low mass, explosive visual], Plasma Ball [high mass, glowing trail]).
* [ ] **Co-op HP Tracking:** Implement a health point pooling system (`boss_health_points`) so multiple client connections can reduce the same target's health synchronously during "Boss Sprint" events.

## 5. Python Reference Blueprint (Calculation Validation)

```python
import math

class TrebuchetSimulation:
    def __init__(self, target_distance, obstacle_height=0):
        self.target_distance = target_distance
        self.obstacle_height = obstacle_height
        self.g = 9.81 # Gravity constant
        
    def validate_inputs(self, player_counterweight, correct_counterweight, player_angle):
        """Validates player math inputs and determines simulation outcomes."""
        if player_counterweight != correct_counterweight:
            # Check if catastrophic failure
            error_margin = abs(player_counterweight - correct_counterweight) / correct_counterweight
            if error_margin > 0.20:
                return "CATASTROPHIC_FAILURE", 0, 90 # Launches straight up/breaks
            
        # Calculate simulated initial velocity based on input accuracy
        # (Assuming correct counterweight gives optimal launch velocity of 25 m/s)
        efficiency = min(player_counterweight / correct_counterweight, 1.2)
        v0 = 25.0 * efficiency
        
        # Calculate expected range based on angle input
        angle_rad = math.radians(player_angle)
        simulated_range = (v0**2 * math.sin(2 * angle_rad)) / self.g
        
        # Determine hit success
        if abs(simulated_range - self.target_distance) <= 2.0: # 2-meter tolerance
            return "SUCCESS", simulated_range, player_angle
        else:
            return "MISS", simulated_range, player_angle
```
