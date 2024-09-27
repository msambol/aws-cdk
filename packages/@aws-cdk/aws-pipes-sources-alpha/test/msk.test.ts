import * as msk from '@aws-cdk/aws-msk-alpha';
import { Pipe } from '@aws-cdk/aws-pipes-alpha';
import { App, Duration, Lazy, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { TestTarget } from './test-classes';
import { MskStartingPosition } from '../lib';
import { MskSource } from '../lib/msk';

describe('MSK source', () => {
  it('should have only source arn and topic name', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });
    const source = new MskSource(cluster, {
      topicName: 'mike',
    });

    new Pipe(stack, 'MyPipe', {
      source,
      target: new TestTarget(),
    });

    // ACT
    const template = Template.fromStack(stack);

    // ASSERT
    template.hasResourceProperties('AWS::Pipes::Pipe', {
      Source: {
        Ref: 'MskClusterA4A0C5DF',
      },
      SourceParameters: {
        ManagedStreamingKafkaParameters: {
          TopicName: 'mike',
        },
      },
    });
  });

  it('should have parameters', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const secret = new Secret(stack, 'Secret');
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });
    const source = new MskSource(cluster, {
      batchSize: 1,
      consumerGroupId: 'test',
      topicName: 'mike',
      tlsAuthSecret: secret,
      maximumBatchingWindow: Duration.seconds(1),
      startingPosition: MskStartingPosition.LATEST,
    });

    new Pipe(stack, 'MyPipe', {
      source,
      target: new TestTarget(),
    });

    // ACT
    const template = Template.fromStack(stack);

    // ASSERT
    template.hasResourceProperties('AWS::Pipes::Pipe', {
      Source: {
        Ref: 'MskClusterA4A0C5DF',
      },
      SourceParameters: {
        ManagedStreamingKafkaParameters: {
          TopicName: 'mike',
          BatchSize: 1,
          ConsumerGroupID: 'test',
          Credentials: {
            ClientCertificateTlsAuth: {
              Ref: 'SecretA720EF05',
            },
          },
          MaximumBatchingWindowInSeconds: 1,
          StartingPosition: 'LATEST',
        },
      },
    });
  });

  it('should have parameters (different permutation)', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const secret = new Secret(stack, 'Secret');
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });
    const source = new MskSource(cluster, {
      batchSize: 1,
      consumerGroupId: 'test',
      topicName: 'mike',
      saslScramSecret: secret,
      maximumBatchingWindow: Duration.seconds(1),
      startingPosition: MskStartingPosition.TRIM_HORIZON,
    });

    new Pipe(stack, 'MyPipe', {
      source,
      target: new TestTarget(),
    });

    // ACT
    const template = Template.fromStack(stack);

    // ASSERT
    template.hasResourceProperties('AWS::Pipes::Pipe', {
      Source: {
        Ref: 'MskClusterA4A0C5DF',
      },
      SourceParameters: {
        ManagedStreamingKafkaParameters: {
          TopicName: 'mike',
          BatchSize: 1,
          ConsumerGroupID: 'test',
          Credentials: {
            SaslScram512Auth: {
              Ref: 'SecretA720EF05',
            },
          },
          MaximumBatchingWindowInSeconds: 1,
          StartingPosition: 'TRIM_HORIZON',
        },
      },
    });
  });

  it('should grant pipe role kafka and ec2 permissions', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const secret = new Secret(stack, 'Secret');
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });
    const source = new MskSource(cluster, {
      batchSize: 1,
      consumerGroupId: 'test',
      topicName: 'mike',
      tlsAuthSecret: secret,
      maximumBatchingWindow: Duration.seconds(1),
      startingPosition: MskStartingPosition.LATEST,
    });

    new Pipe(stack, 'MyPipe', {
      source,
      target: new TestTarget(),
    });

    // ACT
    const template = Template.fromStack(stack);

    // ASSERT
    template.hasResource('AWS::IAM::Policy', {
      Properties: {
        Roles: [{
          Ref: 'MyPipeRoleCBC8E9AB',
        }],
        PolicyDocument: {
          Statement: [{
            Action: [
              'kafka:DescribeCluster',
              'kafka:DescribeClusterV2',
              'kafka:GetBootstrapBrokers',
            ],
            Resource: {
              Ref: 'MskClusterA4A0C5DF',
            },
          },
          {
            Action: [
              'ec2:DescribeNetworkInterfaces',
              'ec2:DescribeSubnets',
              'ec2:DescribeSecurityGroups',
              'ec2:DescribeVpcs',
              'ec2:CreateNetworkInterface',
              'ec2:DeleteNetworkInterface',
            ],
            Resource: '*',
          },
          {
            Action: [
              'secretsmanager:GetSecretValue',
              'secretsmanager:DescribeSecret',
            ],
            Resource: {
              Ref: 'SecretA720EF05',
            },
          }],
        },
      },
    });
  });
});

describe('MSK source parameters validation', () => {
  test('cannot define both saslScramSecret and tlsAuthSecret', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const secret = new Secret(stack, 'Secret');
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });

    // WHEN
    expect(() => {
      new MskSource(cluster, {
        topicName: 'mike',
        tlsAuthSecret: secret,
        saslScramSecret: secret,
      });
    }).toThrow('Either saslScramSecret or tlsAuthSecret can be defined, not both.');
  });

  test('batch size > 10000 should throw', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });

    // WHEN
    expect(() => {
      new MskSource(cluster, {
        topicName: 'mike',
        batchSize: 10001,
      });
    }).toThrow('Batch size must be between 1 and 10000, received 10001');
  });

  test('batch size < 1 should throw', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });

    // WHEN
    expect(() => {
      new MskSource(cluster, {
        topicName: 'mike',
        batchSize: 0,
      });
    }).toThrow('Batch size must be between 1 and 10000, received 0');
  });

  it('validateBatchSize works with a token', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });
    const batchSize = Lazy.number({ produce: () => 1 });
    const source = new MskSource(cluster, {
      topicName: 'mike',
      batchSize,
    });

    new Pipe(stack, 'MyPipe', {
      source,
      target: new TestTarget(),
    });

    // ACT
    const template = Template.fromStack(stack);

    // ASSERT
    template.hasResourceProperties('AWS::Pipes::Pipe', {
      Source: {
        Ref: 'MskClusterA4A0C5DF',
      },
      SourceParameters: {
        ManagedStreamingKafkaParameters: {
          TopicName: 'mike',
          BatchSize: 1,
        },
      },
    });
  });

  test('consumer group ID > 200 should throw', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });

    // WHEN
    expect(() => {
      new MskSource(cluster, {
        topicName: 'mike',
        consumerGroupId: 'x'.repeat(201),
      });
    }).toThrow('Consumer group ID must be between 1 and 200, received 201');
  });

  test('consumer group ID < 1 should throw', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });

    // WHEN
    expect(() => {
      new MskSource(cluster, {
        topicName: 'mike',
        consumerGroupId: '',
      });
    }).toThrow('Consumer group ID must be between 1 and 200, received 0');
  });

  test('validateConsumerGroupId works with a token', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });
    const consumerGroupId = Lazy.string({ produce: () => 'foobar' });
    const source = new MskSource(cluster, {
      topicName: 'mike',
      consumerGroupId,
    });

    new Pipe(stack, 'MyPipe', {
      source,
      target: new TestTarget(),
    });

    // ACT
    const template = Template.fromStack(stack);

    // ASSERT
    template.hasResourceProperties('AWS::Pipes::Pipe', {
      Source: {
        Ref: 'MskClusterA4A0C5DF',
      },
      SourceParameters: {
        ManagedStreamingKafkaParameters: {
          TopicName: 'mike',
          ConsumerGroupID: 'foobar',
        },
      },
    });
  });

  test('maximum batching window > 300 should throw', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });

    // WHEN
    expect(() => {
      new MskSource(cluster, {
        topicName: 'mike',
        maximumBatchingWindow: Duration.seconds(301),
      });
    }).toThrow('Maximum batching window must be between 0 and 300, received 301');
  });

  test('topic name > 249 should throw', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });

    // WHEN
    expect(() => {
      new MskSource(cluster, {
        topicName: 'm'.repeat(250),
      });
    }).toThrow('Topic name must be between 1 and 249, received 250');
  });

  test('Topic name < 1 should throw', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });

    // WHEN
    expect(() => {
      new MskSource(cluster, {
        topicName: '',
      });
    }).toThrow('Topic name must be between 1 and 249, received 0');
  });

  it('validateTopicName works with a token', () => {
    // ARRANGE
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    const vpc = new Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });
    const cluster = new msk.Cluster(stack, 'MskCluster', {
      clusterName: 'integ-test',
      kafkaVersion: msk.KafkaVersion.V3_6_0,
      vpc,
    });
    const topicName = Lazy.string({ produce: () => 'mike' });
    const source = new MskSource(cluster, { topicName });

    new Pipe(stack, 'MyPipe', {
      source,
      target: new TestTarget(),
    });

    // ACT
    const template = Template.fromStack(stack);

    // ASSERT
    template.hasResourceProperties('AWS::Pipes::Pipe', {
      Source: {
        Ref: 'MskClusterA4A0C5DF',
      },
      SourceParameters: {
        ManagedStreamingKafkaParameters: {
          TopicName: 'mike',
        },
      },
    });
  });
});
