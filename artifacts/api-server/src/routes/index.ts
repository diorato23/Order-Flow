import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tablesRouter from "./tables";
import categoriesRouter from "./categories";
import menuRouter from "./menu";
import ordersRouter from "./orders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tablesRouter);
router.use(categoriesRouter);
router.use(menuRouter);
router.use(ordersRouter);

export default router;
