CREATE DATABASE IF NOT EXISTS `cravedash_restaurant_db`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS `cravedash_order_db`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS `cravedash_payment_db`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

GRANT ALL PRIVILEGES ON `cravedash_restaurant_db`.* TO 'cravedash_app'@'%';
GRANT ALL PRIVILEGES ON `cravedash_order_db`.* TO 'cravedash_app'@'%';
GRANT ALL PRIVILEGES ON `cravedash_payment_db`.* TO 'cravedash_app'@'%';
