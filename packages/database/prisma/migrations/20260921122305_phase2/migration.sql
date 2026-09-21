-- AlterTable
ALTER TABLE "Department" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "_DepartmentToPosition" ADD CONSTRAINT "_DepartmentToPosition_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_DepartmentToPosition_AB_unique";

-- AlterTable
ALTER TABLE "_DepartmentToUser" ADD CONSTRAINT "_DepartmentToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_DepartmentToUser_AB_unique";
