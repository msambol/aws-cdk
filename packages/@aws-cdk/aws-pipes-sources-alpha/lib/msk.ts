import { ICluster } from '@aws-cdk/aws-msk-alpha';
import { IPipe, ISource, SourceConfig } from '@aws-cdk/aws-pipes-alpha';
import { Duration, Token } from 'aws-cdk-lib';
import { IRole, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { MskStartingPosition } from './enums';

/**
 * Parameters for the MSK stream.
 */
export interface ManagedStreamingKafkaParameters {
  /**
    * The maximum number of records to include in each batch.
    *
    * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-pipes-pipe-pipesourcemanagedstreamingkafkaparameters.html#cfn-pipes-pipe-pipesourcemanagedstreamingkafkaparameters-batchsize
    * @default 1
    */
  readonly batchSize?: number;

  /**
    * The ID of a Kafka consumer group to join.
    *
    * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-pipes-pipe-pipesourcemanagedstreamingkafkaparameters.html#cfn-pipes-pipe-pipesourcemanagedstreamingkafkaparameters-consumergroupid
    * @default - no consumer group joined
    */
  readonly consumerGroupId?: string;

  /**
    *  Secrets Manager secret for client certificate TLS authentication.
    *
    * Either `tlsAuthSecret` or `saslScramSecret` can be defined, not both.
    *
    * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-pipes-pipe-mskaccesscredentials.html#cfn-pipes-pipe-mskaccesscredentials-clientcertificatetlsauth
    * @default - no authentication if `saslScramSecret` is also undefined
    */
  readonly tlsAuthSecret?: Secret;

  /**
    * Secrets Manager secret for SASL Scram 512 authentication.
    *
    * Either `saslScramSecret` or `tlsAuthSecret` can be defined, not both.
    *
    * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-pipes-pipe-mskaccesscredentials.html#cfn-pipes-pipe-mskaccesscredentials-saslscram512auth
    * @default - no authentication if `tlsAuthSecret` is also undefined
    */
  readonly saslScramSecret?: Secret;

  /**
   * The maximum length of a time to wait for events in seconds.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-pipes-pipe-pipesourcemanagedstreamingkafkaparameters.html#cfn-pipes-pipe-pipesourcemanagedstreamingkafkaparameters-maximumbatchingwindowinseconds
   * @default 1
   */
  readonly maximumBatchingWindow?: Duration;

  /**
   * The position in a stream from which to start reading.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-pipes-pipe-pipesourcemanagedstreamingkafkaparameters.html#cfn-pipes-pipe-pipesourcemanagedstreamingkafkaparameters-startingposition
   * @default MskStartingPosition.LATEST
   */
  readonly startingPosition?: MskStartingPosition;

  /**
   * The name of the topic that the pipe will read from.
   *
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-pipes-pipe-pipesourcemanagedstreamingkafkaparameters.html#cfn-pipes-pipe-pipesourcemanagedstreamingkafkaparameters-topicname
   */
  readonly topicName: string;
}

/**
 * A source that reads from an MSK stream.
 */
export class MskSource implements ISource {
  readonly sourceArn;
  private cluster: ICluster;
  private sourceParameters: ManagedStreamingKafkaParameters;
  private tlsAuthSecret?: Secret;
  private saslScramSecret?: Secret;

  constructor(cluster: ICluster, parameters: ManagedStreamingKafkaParameters) {
    this.cluster = cluster;
    this.sourceArn = cluster.clusterArn;
    this.sourceParameters = parameters;
    this.tlsAuthSecret = this.sourceParameters.tlsAuthSecret;
    this.saslScramSecret = this.sourceParameters.saslScramSecret;

    if (this.tlsAuthSecret && this.saslScramSecret) {
      throw new Error('Either saslScramSecret or tlsAuthSecret can be defined, not both.');
    }

    validateBatchSize(this.sourceParameters.batchSize);
    validateConsumerGroupId(this.sourceParameters.consumerGroupId);
    validateMaximumBatchingWindow(this.sourceParameters.maximumBatchingWindow?.toSeconds());
    validateTopicName(this.sourceParameters.topicName);
  }

  bind(_pipe: IPipe): SourceConfig {
    return {
      sourceParameters: {
        managedStreamingKafkaParameters: {
          batchSize: this.sourceParameters.batchSize,
          consumerGroupId: this.sourceParameters.consumerGroupId,
          credentials: this.tlsAuthSecret || this.saslScramSecret ? {
            saslScram512Auth: this.saslScramSecret?.secretArn,
            clientCertificateTlsAuth: this.tlsAuthSecret?.secretArn,
          }: undefined,
          maximumBatchingWindowInSeconds: this.sourceParameters.maximumBatchingWindow?.toSeconds(),
          startingPosition: this.sourceParameters.startingPosition,
          topicName: this.sourceParameters.topicName,
        },
      },
    };
  }

  grantRead(grantee: IRole): void {
    grantee.addToPrincipalPolicy(new PolicyStatement({
      actions: [
        'kafka:DescribeCluster',
        'kafka:DescribeClusterV2',
        'kafka:GetBootstrapBrokers',
      ],
      resources: [this.cluster.clusterArn],
    }));
    grantee.addToPrincipalPolicy(new PolicyStatement({
      actions: [
        'ec2:DescribeNetworkInterfaces',
        'ec2:DescribeSubnets',
        'ec2:DescribeSecurityGroups',
        'ec2:DescribeVpcs',
        'ec2:CreateNetworkInterface',
        'ec2:DeleteNetworkInterface',
      ],
      resources: ['*'],
    }));

    if (this.tlsAuthSecret) {
      this.tlsAuthSecret.grantRead(grantee);
    }

    if (this.saslScramSecret) {
      this.saslScramSecret.grantRead(grantee);
    }
  }
}

function validateBatchSize(batchSize?: number) {
  if (batchSize !== undefined && !Token.isUnresolved(batchSize)) {
    if (batchSize < 1 || batchSize > 10000) {
      throw new Error(`Batch size must be between 1 and 10000, received ${batchSize}`);
    }
  }
}

function validateConsumerGroupId(consumerGroupId?: string) {
  if (consumerGroupId !== undefined && !Token.isUnresolved(consumerGroupId)) {
    if (consumerGroupId.length < 1 || consumerGroupId.length > 200) {
      throw new Error(`Consumer group ID must be between 1 and 200, received ${consumerGroupId.length}`);
    }
  }
}

function validateMaximumBatchingWindow(window?: number) {
  if (window !== undefined) {
    // only need to check upper bound since Duration amounts cannot be negative
    if (window > 300) {
      throw new Error(`Maximum batching window must be between 0 and 300, received ${window}`);
    }
  }
}

function validateTopicName(topicName: string) {
  if (!Token.isUnresolved(topicName)) {
    if (topicName.length < 1 || topicName.length > 249) {
      throw new Error(`Topic name must be between 1 and 249, received ${topicName.length}`);
    }
  }
}
