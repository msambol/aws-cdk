/// !cdk-integ pragma:disable-update-workflow
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { App, Stack } from 'aws-cdk-lib';
import * as integ from '@aws-cdk/integ-tests-alpha';
import * as eks from '../lib';
import { KubectlV32Layer } from '@aws-cdk/lambda-layer-kubectl-v32';

class EksClusterStack extends Stack {
  constructor(scope: App, id: string) {
    super(scope, id);

    // allow all account users to assume this role in order to admin the cluster
    const mastersRole = new iam.Role(this, 'AdminRole', {
      assumedBy: new iam.AccountRootPrincipal(),
    });

    // just need one nat gateway to simplify the test
    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 3, natGateways: 1, restrictDefaultSecurityGroup: false });

    const cluster = new eks.Cluster(this, 'Cluster', {
      vpc,
      mastersRole,
      endpointAccess: eks.EndpointAccess.PRIVATE,
      version: eks.KubernetesVersion.V1_32,
      kubectlProviderOptions: {
        kubectlLayer: new KubectlV32Layer(this, 'kubectlLayer'),
      },
    });

    // this is the valdiation. it won't work if the private access is not setup properly.
    cluster.addManifest('config-map', {
      kind: 'ConfigMap',
      apiVersion: 'v1',
      data: {
        hello: 'world',
      },
      metadata: {
        name: 'config-map',
      },
    });
  }
}

const app = new App({
  postCliContext: {
    '@aws-cdk/aws-lambda:createNewPoliciesWithAddToRolePolicy': true,
    '@aws-cdk/aws-lambda:useCdkManagedLogGroup': false,
  },
});

const stack = new EksClusterStack(app, 'aws-cdk-eks-cluster-private-endpoint-test');
new integ.IntegTest(app, 'aws-cdk-eks-cluster-private-endpoint', {
  testCases: [stack],
  // Test includes assets that are updated weekly. If not disabled, the upgrade PR will fail.
  diffAssets: false,
});

app.synth();
