import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pricingRouter from "./pricing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pricingRouter);

export default router;
