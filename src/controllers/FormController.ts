import { Request, Response } from "express";
import { FormGeneratorService } from "./../services";
import { BaseController } from ".";
import { IStorage } from "./../stores";
import { GeneratorFactory, FormField } from "./../generators";
import { UrlRoute } from "./../utils";
import { Routes } from "./../constants";
import crypto from "crypto";

export class FormController extends BaseController {
  private storage: IStorage;

  constructor(storage: IStorage) {
    super();
    this.storage = storage;
  }

  public async getSupportedGenerators(
    req: Request,
    res: Response,
  ): Promise<void> {
    const generators = GeneratorFactory.getAvailableGenerators();
    res.json(generators);
  }

  public async getFormFields(
    req: Request,
    res: Response,
  ): Promise<Response<FormField[]>> {
    const generatorType = req.params.generator || "linphone";
    const generator = GeneratorFactory.getGenerator(generatorType);

    return res.json(generator.getFields());
  }

  public async submitForm(req: Request, res: Response): Promise<void> {
    try {
      const generatorType = req.params.generator || "linphone";

      const { ...formData } = req.body;

      const fields: FormField[] = FormGeneratorService.getFormFields(generatorType);
      const errors: Record<string, string> = {};

      for (const field of fields) {
        if (field.required && !formData[field.name]) {
          errors[field.name] = `The ${field.label || field.name} field is required.`;
        }
      }

      if (Object.keys(errors).length > 0) {
        res.status(400).json({ errors });
        return;
      }

      // Generate a random key for retrieval
      const key = crypto.randomBytes(16).toString("hex");

      // Store data in Redis with expiration (e.g., 10 minutes)
      await this.storage.set(key, JSON.stringify({
        generatorType: generatorType,
        data: { ...formData },
      }));

      // Generate the full URL for config download
      const qrUrl = UrlRoute.make(Routes.QR, { key }, UrlRoute.url(req));
      const configUrl = UrlRoute.make(
        Routes.CONFIG,
        { key },
        UrlRoute.url(req),
      );

      res.json({
        message: "Configuration stored",
        qr: qrUrl,
        url: configUrl,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Failed to process form submission" });
    }
  }

  public async renderForm(req: Request, res: Response): Promise<void> {
    const generators = GeneratorFactory.getAvailableGenerators();
    res.render("form.njk", {
      title: "Submit Configuration",
      generators: generators
    });
  }
}
