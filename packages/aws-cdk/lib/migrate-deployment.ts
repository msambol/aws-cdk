import { error } from 'console';
import * as cxapi from '@aws-cdk/cx-api';
import * as chalk from 'chalk';
import { Deployments, DeployStackOptions } from './api/deployments';
import { ResourcesToImport } from './api/util/cloudformation';

export class MigrateDeployment {
  constructor(
    private readonly stack: cxapi.CloudFormationStackArtifact,
    private readonly cfn: Deployments,
  ) { }

  public async migrateResources(resourcesToImport: ResourcesToImport, options: DeployStackOptions) {
    const initialImportTemplate = this.removeNonImportResources();

    try {
      await this.cfn.deployStack({
        ...options,
        resourcesToImport,
        overrideTemplate: initialImportTemplate,
      });
    } catch (e) {
      error('\n ❌  %s failed: %s', chalk.bold(options.stack.displayName), e);
      throw e;
    }
  }

  private removeNonImportResources() {
    const template = this.stack.template;
    delete template.Resources.CDKMetadata;
    delete template.Outputs;
    return template;
  }
}