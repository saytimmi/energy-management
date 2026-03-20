-- CreateTable
CREATE TABLE "Habit" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "routineSlot" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "energyType" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "customDays" TEXT,
    "triggerAction" TEXT,
    "duration" INTEGER,
    "whyToday" TEXT,
    "whyMonth" TEXT,
    "whyYear" TEXT,
    "whyIdentity" TEXT,
    "isItBeneficial" TEXT,
    "breakTrigger" TEXT,
    "replacement" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'seed',
    "stageUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streakCurrent" INTEGER NOT NULL DEFAULT 0,
    "streakBest" INTEGER NOT NULL DEFAULT 0,
    "consistency30d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freezesUsedThisWeek" INTEGER NOT NULL DEFAULT 0,
    "microActionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitLog" (
    "id" SERIAL NOT NULL,
    "habitId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "note" TEXT,

    CONSTRAINT "HabitLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HabitLog_habitId_date_key" ON "HabitLog"("habitId", "date");

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitLog" ADD CONSTRAINT "HabitLog_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitLog" ADD CONSTRAINT "HabitLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
