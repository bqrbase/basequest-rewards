import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DailyCheckInModule", (m) => {
  const owner = m.getAccount(0);
  const dailyCheckIn = m.contract("DailyCheckIn", [owner]);
  return { dailyCheckIn };
});
